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
      
      // STEP 1: Resolve target company_id using same logic as RPCs
      let targetCompanyId: string | null = null;
      let targetCompanyName: string | null = null;
      let targetWikidataQid: string | null = null;
      let targetEntity: any = null;
      
      // Try 1: Check existing company_ownership link
      const { data: existingOwnership } = await supabase
        .from('company_ownership')
        .select('parent_company_id')
        .eq('child_brand_id', brand_id)
        .single();
      
      if (existingOwnership?.parent_company_id) {
        targetCompanyId = existingOwnership.parent_company_id;
        console.log(`[enrich-brand-wiki] Resolved via existing ownership: ${targetCompanyId}`);
      }
      
      // Try 2: Check brand_data_mappings for wikidata link
      if (!targetCompanyId) {
        const { data: mapping } = await supabase
          .from('brand_data_mappings')
          .select('external_id')
          .eq('brand_id', brand_id)
          .eq('source', 'wikidata')
          .single();
        
        if (mapping?.external_id) {
          const { data: companyByMapping } = await supabase
            .from('companies')
            .select('id, name, wikidata_qid')
            .eq('wikidata_qid', mapping.external_id)
            .single();
          
          if (companyByMapping) {
            targetCompanyId = companyByMapping.id;
            targetCompanyName = companyByMapping.name;
            targetWikidataQid = companyByMapping.wikidata_qid;
            console.log(`[enrich-brand-wiki] Resolved via mapping: ${targetCompanyId}`);
          }
        }
      }
      
      // Try 3: Check if brand's QID matches a company
      if (!targetCompanyId && qid) {
        const { data: companyByQid } = await supabase
          .from('companies')
          .select('id, name, wikidata_qid')
          .eq('wikidata_qid', qid)
          .single();
        
        if (companyByQid) {
          targetCompanyId = companyByQid.id;
          targetCompanyName = companyByQid.name;
          targetWikidataQid = companyByQid.wikidata_qid;
          console.log(`[enrich-brand-wiki] Resolved via brand QID: ${targetCompanyId}`);
        }
      }
      
      // STEP 2: If no company exists, create one (from parent P749 or brand itself)
      const claims = entity.claims || {};
      const parentClaims = claims.P749;
      
      if (!targetCompanyId) {
        // Check for parent organization (P749)
        if (parentClaims && parentClaims.length > 0) {
          const parentQid = parentClaims[0].mainsnak?.datavalue?.value?.id;
          
          if (parentQid) {
            console.log(`[enrich-brand-wiki] Found parent P749: ${parentQid}`);
            
            // Fetch parent company data
            const parentUrl = `https://www.wikidata.org/wiki/Special:EntityData/${parentQid}.json`;
            const parentRes = await fetch(parentUrl);
            
            if (parentRes.ok) {
              const parentJson = await parentRes.json();
              const parentEntity = parentJson.entities?.[parentQid];
              
              if (parentEntity) {
                targetEntity = parentEntity;
                targetWikidataQid = parentQid;
                targetCompanyName = parentEntity.labels?.en?.value;
              }
            }
          }
        } else {
          // No parent—treat the brand itself as the company
          console.log(`[enrich-brand-wiki] No parent found, using brand entity as company`);
          targetEntity = entity;
          targetWikidataQid = qid;
          targetCompanyName = brand.name;
        }
        
        // Create company record if we have entity data
        if (targetEntity && targetWikidataQid && targetCompanyName) {
          const entityClaims = targetEntity.claims || {};
          const ticker = entityClaims.P414?.[0]?.mainsnak?.datavalue?.value;
          const exchange = entityClaims.P414?.[0]?.qualifiers?.P249?.[0]?.datavalue?.value?.id;
          const isPublic = !!ticker;
          const country = entityClaims.P17?.[0]?.mainsnak?.datavalue?.value?.id;
          
          const { data: newCompany, error: companyError } = await supabase
            .from('companies')
            .upsert({
              wikidata_qid: targetWikidataQid,
              name: targetCompanyName,
              ticker: ticker || null,
              exchange: exchange || null,
              is_public: isPublic,
              country: country || null,
              description: targetEntity.descriptions?.en?.value || null,
              logo_url: null,
            }, {
              onConflict: 'wikidata_qid',
              ignoreDuplicates: false
            })
            .select()
            .single();
          
          if (companyError) {
            console.error('[enrich-brand-wiki] Company upsert failed:', companyError);
          } else if (newCompany) {
            targetCompanyId = newCompany.id;
            console.log(`[enrich-brand-wiki] Created company: ${targetCompanyName} (${targetCompanyId})`);
            
            // Create brand_data_mapping
            await supabase
              .from('brand_data_mappings')
              .upsert({
                brand_id: brand_id,
                source: 'wikidata',
                external_id: targetWikidataQid,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'brand_id,source',
                ignoreDuplicates: false
              });
            
            // Create ownership link if this was a parent
            if (parentClaims && parentClaims.length > 0) {
              await supabase
                .from('company_ownership')
                .upsert({
                  child_brand_id: brand_id,
                  parent_company_id: targetCompanyId,
                  parent_name: targetCompanyName,
                  relationship: 'parent',
                  confidence: 0.9,
                  source: 'wikidata'
                }, {
                  onConflict: 'child_brand_id',
                  ignoreDuplicates: false
                });
              
              console.log(`[enrich-brand-wiki] Linked ownership: ${brand.name} -> ${targetCompanyName}`);
            }
          }
        }
      } else {
        // Company exists—fetch its entity for people extraction
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('wikidata_qid, name')
          .eq('id', targetCompanyId)
          .single();
        
        if (existingCompany?.wikidata_qid) {
          targetWikidataQid = existingCompany.wikidata_qid;
          targetCompanyName = existingCompany.name;
          
          const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${targetWikidataQid}.json`;
          const entityRes = await fetch(entityUrl);
          
          if (entityRes.ok) {
            const entityJson = await entityRes.json();
            if (targetWikidataQid) {
              targetEntity = entityJson.entities?.[targetWikidataQid];
            }
          }
        }
      }
      
      // STEP 3: Extract people and shareholders for the resolved company
      if (targetCompanyId && targetEntity) {
        console.log(`[enrich-brand-wiki] Extracting people for company ${targetCompanyId}`);
        
        const entityClaims = targetEntity.claims || {};
        
        // Extract key people (CEO, Chairperson, Founder)
        const peopleRoles = {
          P169: 'chief_executive_officer',
          P488: 'chairperson',
          P112: 'founder'
        };
        
        for (const [prop, role] of Object.entries(peopleRoles)) {
          const peopleClaims = entityClaims[prop];
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
                    
                    // Upsert person
                    await supabase
                      .from('company_people')
                      .upsert({
                        company_id: targetCompanyId,
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
      } else {
        console.log(`[enrich-brand-wiki] WARNING: Could not resolve target company_id for brand ${brand_id}`);
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
