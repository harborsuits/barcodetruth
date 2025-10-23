import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { brand_id, wikidata_qid, mode = 'desc-only' } = await req.json();
    
    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: "brand_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enrich-brand-wiki] Enriching brand ${brand_id} (mode: ${mode})`);

    // Get brand data
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid, description, description_source')
      .eq('id', brand_id)
      .single();

    if (brandError || !brand) {
      throw new Error('Brand not found');
    }

    let qid = wikidata_qid || brand.wikidata_qid;
    let wiki_en_title: string | null = null;
    let description: string | null = null;

    // Step 1: Find Wikidata QID if not provided
    if (!qid) {
      console.log(`[enrich-brand-wiki] Searching Wikidata for: ${brand.name}`);
      
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(brand.name + ' company')}&language=en&format=json&limit=5&type=item`;
      const searchRes = await fetch(searchUrl);
      
      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        const filtered = searchJson.search?.filter((r: any) => {
          const desc = (r.description || '').toLowerCase();
          return !desc.includes('disambiguation') && 
                 !desc.includes('surname') &&
                 (desc.includes('company') || desc.includes('brand') || desc.includes('corporation'));
        });
        
        if (filtered?.length > 0) {
          qid = filtered[0].id;
          console.log(`[enrich-brand-wiki] Found QID: ${qid}`);
        }
      }
    }

    if (!qid) {
      return new Response(
        JSON.stringify({ error: 'Could not find Wikidata QID' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Fetch Wikidata entity
    console.log(`[enrich-brand-wiki] Fetching Wikidata entity ${qid}`);
    const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    const entityRes = await fetch(entityUrl);
    
    if (!entityRes.ok) {
      throw new Error('Failed to fetch Wikidata entity');
    }

    const entityJson = await entityRes.json();
    const entity = entityJson.entities?.[qid];
    
    if (!entity) {
      throw new Error('Wikidata entity not found');
    }

    // Get Wikipedia title
    wiki_en_title = entity.sitelinks?.enwiki?.title;

    // Step 3: Get Wikipedia description
    if (wiki_en_title && (!brand.description || brand.description_source !== 'wikipedia')) {
      console.log(`[enrich-brand-wiki] Fetching Wikipedia extract`);
      const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(wiki_en_title)}&format=json`;
      const extractRes = await fetch(extractUrl);
      
      if (extractRes.ok) {
        const extractJson = await extractRes.json();
        const pages = extractJson.query?.pages;
        if (pages) {
          const pageId = Object.keys(pages)[0];
          description = pages[pageId]?.extract;
        }
      }
    }

    // Step 4: Update brand with description and QID
    if (description && description.length >= 40) {
      await supabase
        .from('brands')
        .update({
          description,
          description_source: 'wikipedia',
          description_lang: 'en',
          wikidata_qid: qid
        })
        .eq('id', brand_id);
      
      console.log(`[enrich-brand-wiki] Updated brand description`);
    } else if (!brand.wikidata_qid) {
      // At least save the QID
      await supabase
        .from('brands')
        .update({ wikidata_qid: qid })
        .eq('id', brand_id);
    }

    // Step 5: FULL MODE - Extract ownership, people, shareholders
    if (mode === 'full') {
      console.log(`[enrich-brand-wiki] Running full enrichment (ownership + people)`);
      
      const claims = entity.claims || {};
      
      // Parent organization (P749)
      const parentClaims = claims.P749;
      if (parentClaims && parentClaims.length > 0) {
        const parentQid = parentClaims[0].mainsnak?.datavalue?.value?.id;
        
        if (parentQid) {
          console.log(`[enrich-brand-wiki] Found parent: ${parentQid}`);
          
          // Fetch parent company data
          const parentUrl = `https://www.wikidata.org/wiki/Special:EntityData/${parentQid}.json`;
          const parentRes = await fetch(parentUrl);
          
          if (parentRes.ok) {
            const parentJson = await parentRes.json();
            const parentEntity = parentJson.entities?.[parentQid];
            
            if (parentEntity) {
              const parentName = parentEntity.labels?.en?.value;
              const parentClaims = parentEntity.claims || {};
              
              // Extract parent company details
              const ticker = parentClaims.P414?.[0]?.mainsnak?.datavalue?.value;
              const exchange = parentClaims.P414?.[0]?.qualifiers?.P249?.[0]?.datavalue?.value?.id;
              const isPublic = !!ticker;
              const country = parentClaims.P17?.[0]?.mainsnak?.datavalue?.value?.id;
              
              // Upsert company (idempotent on wikidata_qid)
              const { data: company, error: companyError } = await supabase
                .from('companies')
                .upsert({
                  wikidata_qid: parentQid,
                  name: parentName,
                  ticker: ticker || null,
                  exchange: exchange || null,
                  is_public: isPublic,
                  country: country || null,
                  description: parentEntity.descriptions?.en?.value || null,
                  logo_url: null, // Will be resolved separately
                }, {
                  onConflict: 'wikidata_qid',
                  ignoreDuplicates: false
                })
                .select()
                .single();
              
              if (companyError) {
                console.error('[enrich-brand-wiki] Company upsert failed:', companyError);
              } else if (company) {
                console.log(`[enrich-brand-wiki] Upserted company: ${parentName}`);
                
                // Upsert brand_data_mappings (idempotent on brand_id + source)
                await supabase
                  .from('brand_data_mappings')
                  .upsert({
                    brand_id: brand_id,
                    source: 'wikidata',
                    external_id: parentQid,
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'brand_id,source',
                    ignoreDuplicates: false
                  });
                
                // Upsert company_ownership (idempotent on child_brand_id)
                await supabase
                  .from('company_ownership')
                  .upsert({
                    child_brand_id: brand_id,
                    parent_company_id: company.id,
                    parent_name: parentName,
                    relationship: 'parent',
                    confidence: 0.9,
                    source: 'wikidata'
                  }, {
                    onConflict: 'child_brand_id',
                    ignoreDuplicates: false
                  });
                
                console.log(`[enrich-brand-wiki] Linked ownership: ${brand.name} -> ${parentName}`);
                
                // Extract key people (CEO, Chairperson, Founder)
                const peopleRoles = {
                  P169: 'chief_executive_officer',
                  P488: 'chairperson',
                  P112: 'founder'
                };
                
                for (const [prop, role] of Object.entries(peopleRoles)) {
                  const peopleClaims = parentClaims[prop];
                  if (peopleClaims) {
                    // Take up to 2 people per role
                    for (const claim of peopleClaims.slice(0, 2)) {
                      const personQid = claim.mainsnak?.datavalue?.value?.id;
                      if (personQid) {
                        // Fetch person data
                        const personUrl = `https://www.wikidata.org/wiki/Special:EntityData/${personQid}.json`;
                        const personRes = await fetch(personUrl);
                        
                        if (personRes.ok) {
                          const personJson = await personRes.json();
                          const personEntity = personJson.entities?.[personQid];
                          
                          if (personEntity) {
                            const personName = personEntity.labels?.en?.value;
                            const imageUrl = personEntity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
                            
                            // Upsert person (allow duplicates per role)
                            await supabase
                              .from('company_people')
                              .upsert({
                                company_id: company.id,
                                role: role,
                                person_name: personName,
                                person_qid: personQid,
                                image_url: imageUrl ? `https://commons.wikimedia.org/wiki/Special:FilePath/${imageUrl}` : null,
                                source: 'wikidata'
                              }, {
                                onConflict: 'company_id,person_qid',
                                ignoreDuplicates: false
                              });
                            
                            console.log(`[enrich-brand-wiki] Added ${role}: ${personName}`);
                          }
                        }
                        
                        // Small delay between person lookups
                        await new Promise(r => setTimeout(r, 200));
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        wikidata_qid: qid,
        wiki_en_title,
        mode,
        description_updated: !!description
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[enrich-brand-wiki] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
