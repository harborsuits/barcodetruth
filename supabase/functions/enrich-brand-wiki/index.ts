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

  const startTime = Date.now();
  let brandId: string | null = null;
  
  // Track enrichment metrics
  const enrichmentMetrics = {
    parent_found: false,
    people_added: 0,
    ticker_added: false,
    description_length: 0,
    logo_found: false,
    country_found: false,
    properties_found: [] as string[],
    error_message: null as string | null
  };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    brandId = url.searchParams.get('brand_id');
    const mode = url.searchParams.get('mode'); // 'missing' for batch mode
    
    // Batch mode: process brands missing descriptions
    if (mode === 'missing') {
      console.log('[enrich-brand-wiki] Batch mode: processing brands missing descriptions');
      
      const { data: brands, error: fetchError } = await supabase
        .from('brands')
        .select('id, name')
        .is('description', null)
        .eq('is_active', true)
        .limit(10);
      
      if (fetchError || !brands || brands.length === 0) {
        console.log('[enrich-brand-wiki] No brands to enrich');
        return new Response(
          JSON.stringify({ success: true, processed: 0, note: 'No brands missing descriptions' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[enrich-brand-wiki] Found ${brands.length} brands to enrich`);
      let processed = 0;
      
      for (const brand of brands) {
        try {
          // Call self recursively for each brand
          const enrichUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-brand-wiki?brand_id=${brand.id}`;
          await fetch(enrichUrl, {
            headers: {
              'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            }
          });
          processed++;
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (e) {
          console.error(`[enrich-brand-wiki] Failed to enrich ${brand.name}:`, e);
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, processed, total: brands.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Single brand mode
    if (!brandId) {
      return new Response(
        JSON.stringify({ error: "brand_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enrich-brand-wiki] Enriching brand: ${brandId}`);

    // Get brand with parent company info
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select(`
        id, 
        name, 
        wikidata_qid, 
        description, 
        description_source,
        company_ownership!company_ownership_child_brand_id_fkey (
          parent_company_id,
          companies!company_ownership_parent_company_id_fkey (
            id,
            name,
            description,
            wikidata_qid,
            description_source
          )
        )
      `)
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      console.error('[enrich-brand-wiki] Brand not found:', brandError);
      return new Response(
        JSON.stringify({ error: "Brand not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine enrichment target: parent company if exists, otherwise brand
    const ownership = Array.isArray(brand.company_ownership) 
      ? brand.company_ownership[0] 
      : brand.company_ownership;
    const company = ownership?.companies 
      ? (Array.isArray(ownership.companies) ? ownership.companies[0] : ownership.companies)
      : null;
    
    let targetName = brand.name;
    let targetId = brand.id;
    let targetTable = 'brands';
    let targetDescription = brand.description;
    let targetSource = brand.description_source;
    let targetQid = brand.wikidata_qid;
    
    if (company) {
      // Enrich the parent company instead
      targetName = company.name;
      targetId = company.id;
      targetTable = 'companies';
      targetDescription = company.description;
      targetSource = company.description_source;
      targetQid = company.wikidata_qid;
      console.log(`[enrich-brand-wiki] Enriching parent company: ${targetName}`);
    } else {
      console.log(`[enrich-brand-wiki] No parent company, enriching brand: ${targetName}`);
    }

    // Skip if already has Wikipedia description
    if (targetDescription && targetSource === 'wikipedia') {
      console.log(`[enrich-brand-wiki] ${targetTable} ${targetName} already has Wikipedia description`);
      return new Response(
        JSON.stringify({ 
          success: true,
          target: targetName,
          note: "Already has Wikipedia description"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let description = null;
    let wikidata_qid = targetQid;

    // Step 1: Search Wikidata for the target if we don't have QID
    if (!wikidata_qid) {
      console.log(`[enrich-brand-wiki] Searching Wikidata for: ${targetName}`);
      
      // Build context-aware search queries
      const searchQueries: string[] = [];
      
      // If there's a parent company in ownership chain, search that first
      if (company && company.name) {
        searchQueries.push(company.name);
        console.log(`[enrich-brand-wiki] Will try parent company: ${company.name}`);
      }
      
      // Add target name with context
      searchQueries.push(
        `${targetName} company`,
        `${targetName} food company`,
        `${targetName} corporation`,
        `${targetName} brand`,
        `${targetName} consumer goods`,
        targetName // Fallback to just the name
      );
      
      console.log('[enrich-brand-wiki] Trying search queries:', searchQueries.slice(0, 3));
      
      // Try each query until we get good results
      for (const query of searchQueries) {
        if (wikidata_qid) break; // Already found
        
        const wikidataSearchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=5&type=item`;
        
        const wikidataRes = await fetch(wikidataSearchUrl);
        if (wikidataRes.ok) {
          const wikidataJson = await wikidataRes.json();
          
          if (wikidataJson.search && wikidataJson.search.length > 0) {
            // Aggressively filter results
            const filtered = wikidataJson.search.filter((result: any) => {
              const desc = (result.description || '').toLowerCase();
              
              // EXCLUDE disambiguation pages, people, places
              if (desc.includes('disambiguation') ||
                  desc.includes('may refer to') ||
                  desc.includes('surname') ||
                  desc.includes('given name') ||
                  desc.includes('family name') ||
                  desc.includes('village') ||
                  desc.includes('town') ||
                  desc.includes('city') ||
                  desc.includes('person') ||
                  desc.includes('people')) {
                console.log(`[enrich-brand-wiki] Filtered out: ${result.label} - ${desc}`);
                return false;
              }
              
              // PREFER companies, brands, organizations
              const isRelevant = 
                desc.includes('company') ||
                desc.includes('brand') ||
                desc.includes('corporation') ||
                desc.includes('business') ||
                desc.includes('manufacturer') ||
                desc.includes('organization') ||
                desc.includes('enterprise') ||
                !result.description; // No description might be fine
              
              return isRelevant;
            });
            
            if (filtered.length > 0) {
              wikidata_qid = filtered[0].id;
              console.log(`[enrich-brand-wiki] ✅ Found good match with query "${query}": ${filtered[0].label} - ${filtered[0].description || 'no description'}`);
              break;
            } else {
              console.log(`[enrich-brand-wiki] No relevant results for query "${query}"`);
            }
          }
        }
      }
      
      if (!wikidata_qid) {
        console.log('[enrich-brand-wiki] ❌ No suitable Wikidata entity found after trying all queries');
      }
    }

    // Step 2: Get Wikipedia page title from Wikidata AND validate entity type
    let wikipediaTitle = null;
    if (wikidata_qid) {
      console.log(`[enrich-brand-wiki] Fetching and validating Wikidata entity ${wikidata_qid}`);
      const wikidataEntityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidata_qid}&format=json&props=sitelinks|claims`;
      
      const entityRes = await fetch(wikidataEntityUrl);
      if (entityRes.ok) {
        const entityJson = await entityRes.json();
        const entity = entityJson.entities?.[wikidata_qid];
        
        // CRITICAL: Validate entity type using P31 (instance of)
        const instanceOf = entity?.claims?.['P31'];
        const instanceOfIds = instanceOf?.map((claim: any) => claim.mainsnak?.datavalue?.value?.id) || [];
        
        console.log(`[enrich-brand-wiki] Entity P31 (instance of): ${instanceOfIds.join(', ')}`);
        
        // EXCLUDE sports events, tournaments, competitions, etc.
        const badEntityTypes = [
          'Q18608583', // sports competition
          'Q500834',   // association football competition  
          'Q27020041', // sports season
          'Q15061018', // FIFA Women's World Cup
          'Q19317',    // tournament
          'Q2990593',  // sports event
          'Q1656682',  // sports championship
          'Q1194951',  // association football tournament
        ];
        
        // CHECK if any instance is a bad type
        const isBadEntity = instanceOfIds.some((id: string) => badEntityTypes.includes(id));
        
        if (isBadEntity) {
          console.log(`[enrich-brand-wiki] ❌ REJECTED: Entity is a sports event/tournament, not a company`);
          wikidata_qid = null; // Clear it and search for correct entity
        } else {
          // REQUIRE entity to be a company/brand/organization
          const goodEntityTypes = [
            'Q4830453',  // business
            'Q783794',   // company
            'Q891723',   // public company
            'Q6881511',  // enterprise
            'Q167037',   // corporation
            'Q658255',   // conglomerate
            'Q1664720',  // institute
            'Q4830453',  // business enterprise
            'Q431289',   // brand
            'Q1664720',  // organization
            'Q43229',    // organization
            'Q20202269', // brand
          ];
          
          const isGoodEntity = instanceOfIds.some((id: string) => goodEntityTypes.includes(id));
          
          if (!isGoodEntity && instanceOfIds.length > 0) {
            console.log(`[enrich-brand-wiki] ⚠️ WARNING: Entity might not be a company (${instanceOfIds.join(', ')})`);
            // Don't reject outright, but log it
          }
          
          wikipediaTitle = entity?.sitelinks?.enwiki?.title;
          console.log(`[enrich-brand-wiki] ✅ Valid entity - Wikipedia title: ${wikipediaTitle}`);
        }
      }
    }
    
    // If entity was invalid, search again
    if (!wikidata_qid && targetName) {
      console.log(`[enrich-brand-wiki] Previous entity invalid, searching again for: ${targetName}`);
      
      const searchQueries = [
        `${targetName} company`,
        `${targetName} brand`,
        `${targetName} corporation`,
        targetName
      ];
      
      for (const query of searchQueries) {
        const wikidataSearchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=5&type=item`;
        
        const wikidataRes = await fetch(wikidataSearchUrl);
        if (wikidataRes.ok) {
          const wikidataJson = await wikidataRes.json();
          
          if (wikidataJson.search && wikidataJson.search.length > 0) {
            // Filter and validate
            for (const result of wikidataJson.search) {
              const desc = (result.description || '').toLowerCase();
              
              // Skip obvious non-companies
              if (desc.includes('tournament') || desc.includes('championship') || 
                  desc.includes('world cup') || desc.includes('competition') ||
                  desc.includes('sport event') || desc.includes('disambiguation')) {
                continue;
              }
              
              // Prefer company descriptions
              if (desc.includes('company') || desc.includes('brand') || 
                  desc.includes('corporation') || desc.includes('manufacturer')) {
                wikidata_qid = result.id;
                console.log(`[enrich-brand-wiki] ✅ Found validated entity: ${result.label} - ${desc}`);
                break;
              }
            }
          }
        }
        
        if (wikidata_qid) break;
      }
    }

    // Step 3: Fallback to direct Wikipedia search if no Wikidata match
    if (!wikipediaTitle) {
      console.log(`[enrich-brand-wiki] Searching Wikipedia directly for: ${targetName}`);
      const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(targetName)}&limit=1&format=json`;
      
      const wikiSearchRes = await fetch(wikiSearchUrl);
      if (wikiSearchRes.ok) {
        const wikiSearchJson = await wikiSearchRes.json();
        if (wikiSearchJson[1] && wikiSearchJson[1].length > 0) {
          wikipediaTitle = wikiSearchJson[1][0];
          console.log(`[enrich-brand-wiki] Found Wikipedia title via search: ${wikipediaTitle}`);
        }
      }
    }

    // Step 4: Get Wikipedia extract
    if (wikipediaTitle) {
      console.log(`[enrich-brand-wiki] Fetching extract for: ${wikipediaTitle}`);
      const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(wikipediaTitle)}&format=json`;
      
      const extractRes = await fetch(extractUrl);
      if (extractRes.ok) {
        const extractJson = await extractRes.json();
        const pages = extractJson.query?.pages;
        if (pages) {
          const pageId = Object.keys(pages)[0];
          description = pages[pageId]?.extract;
          console.log(`[enrich-brand-wiki] Got description (${description?.length || 0} chars)`);
        }
      }
    }

    // Step 5: Update target table if we got description
    if (description) {
      enrichmentMetrics.description_length = description.length;
      
      const updates: any = {
        description,
        description_source: 'wikipedia',
        description_lang: 'en'
      };
      
      if (wikidata_qid && !targetQid) {
        updates.wikidata_qid = wikidata_qid;
      }

      const { error: updateError } = await supabase
        .from(targetTable)
        .update(updates)
        .eq('id', targetId);

      if (updateError) {
        console.error('[enrich-brand-wiki] Update error:', updateError);
        enrichmentMetrics.error_message = `Failed to update ${targetTable}: ${updateError.message}`;
        return new Response(
          JSON.stringify({ error: `Failed to update ${targetTable}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[enrich-brand-wiki] ✅ Updated ${targetTable} ${targetName} with Wikipedia description`);

      // Step 6: Enrich parent company & key people if we have wikidata_qid
      let parentCompanyAdded = false;
      let keyPeopleAdded = 0;
      let tickerAdded = false;
      
      if (wikidata_qid && targetTable === 'brands') {
        console.log(`[enrich-brand-wiki] Enriching ownership & key people for ${targetName}`);
        
        try {
          // Fetch Wikidata entity details
          const wikidataEntityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${wikidata_qid}.json`;
          const entityRes = await fetch(wikidataEntityUrl);
          
          if (entityRes.ok) {
            const entityData = await entityRes.json();
            const claims = entityData.entities?.[wikidata_qid]?.claims || {};
            
            // Extract parent organization (P749)
            const parentOrgClaim = claims['P749']?.[0];
            if (parentOrgClaim) {
              const parentQid = parentOrgClaim.mainsnak?.datavalue?.value?.id;
              if (parentQid) {
                // Fetch parent details
                const parentEntityRes = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${parentQid}.json`);
                if (parentEntityRes.ok) {
                  const parentData = await parentEntityRes.json();
                  const parentEntity = parentData.entities?.[parentQid];
                  const parentName = parentEntity?.labels?.en?.value;
                  
                  if (parentName) {
                    // Check if parent company already exists
                    const { data: existingCompany } = await supabase
                      .from('companies')
                      .select('id, is_public, ticker')
                      .eq('wikidata_qid', parentQid)
                      .maybeSingle();
                    
                    let companyId = existingCompany?.id;
                    
                    if (!companyId) {
                      // Create parent company - also fetch Wikipedia data for it
                      console.log(`[enrich-brand-wiki] Creating new parent company: ${parentName}`);
                      
                      // Get Wikipedia title and description for parent
                      const parentWikiTitle = parentEntity?.sitelinks?.enwiki?.title;
                      let parentDescription = null;
                      
                      if (parentWikiTitle) {
                        const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(parentWikiTitle)}&format=json`;
                        const extractRes = await fetch(extractUrl);
                        if (extractRes.ok) {
                          const extractJson = await extractRes.json();
                          const pages = extractJson.query?.pages;
                          if (pages) {
                            const pageId = Object.keys(pages)[0];
                            parentDescription = pages[pageId]?.extract;
                          }
                        }
                      }
                      
                      // Get country (P17)
                      const countryClaim = parentEntity?.claims?.['P17']?.[0];
                      const countryQid = countryClaim?.mainsnak?.datavalue?.value?.id;
                      let country = null;
                      if (countryQid) {
                        const countryRes = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${countryQid}.json`);
                        if (countryRes.ok) {
                          const countryData = await countryRes.json();
                          country = countryData.entities?.[countryQid]?.labels?.en?.value;
                        }
                      }
                      
                      const { data: newCompany } = await supabase
                        .from('companies')
                        .insert({
                          name: parentName,
                          wikidata_qid: parentQid,
                          description: parentDescription,
                          description_source: parentDescription ? 'wikipedia' : null,
                          description_lang: parentDescription ? 'en' : null,
                          country: country,
                          wikipedia_title: parentWikiTitle
                        })
                        .select('id')
                        .single();
                      companyId = newCompany?.id;
                      
                      if (country) {
                        enrichmentMetrics.country_found = true;
                        enrichmentMetrics.properties_found.push('P17');
                      }
                      
                      console.log(`[enrich-brand-wiki] Created parent company with description (${parentDescription?.length || 0} chars) and country (${country})`);
                    }
                    
                    if (companyId) {
                      // Check if ownership relationship already exists
                      const { data: existingOwnership } = await supabase
                        .from('company_ownership')
                        .select('id')
                        .eq('child_brand_id', brandId)
                        .eq('parent_company_id', companyId)
                        .maybeSingle();
                      
                      if (!existingOwnership) {
                        // Insert ownership relationship
                        const { error: ownershipError } = await supabase
                          .from('company_ownership')
                          .insert({
                            parent_company_id: companyId,
                            child_brand_id: brandId,
                            parent_name: parentName,
                            source: 'wikidata',
                            source_ref: `https://www.wikidata.org/wiki/${parentQid}`,
                            confidence: 0.9
                          });
                        
                        if (!ownershipError) {
                          parentCompanyAdded = true;
                          enrichmentMetrics.parent_found = true;
                          enrichmentMetrics.properties_found.push('P749');
                          console.log(`[enrich-brand-wiki] Added parent company: ${parentName}`);
                        }
                      }
                      
                      // If parent is public and has ticker, add to brand_data_mappings
                      const parentClaims = parentEntity?.claims || {};
                      
                      // Check if company is publicly traded (P414 - stock exchange)
                      const exchangeClaim = parentClaims['P414']?.[0];
                      const isPublic = !!exchangeClaim;
                      
                      // Get ticker symbol (P249 - ticker symbol, or P414 qualifier)
                      let tickerValue = parentClaims['P249']?.[0]?.mainsnak?.datavalue?.value;
                      if (!tickerValue && exchangeClaim) {
                        tickerValue = exchangeClaim.qualifiers?.['P249']?.[0]?.datavalue?.value;
                      }
                      
                      // Update company with public status and ticker if found
                      if (companyId && (isPublic || tickerValue)) {
                        const companyUpdate: any = {};
                        if (isPublic) companyUpdate.is_public = true;
                        if (tickerValue) companyUpdate.ticker = tickerValue;
                        
                        await supabase
                          .from('companies')
                          .update(companyUpdate)
                          .eq('id', companyId);
                        
                        console.log(`[enrich-brand-wiki] Updated parent company: is_public=${isPublic}, ticker=${tickerValue || 'none'}`);
                      }
                      
                      if (tickerValue) {
                        // Check if ticker mapping already exists
                        const { data: existingTicker } = await supabase
                          .from('brand_data_mappings')
                          .select('id')
                          .eq('brand_id', brandId)
                          .eq('source', 'sec')
                          .eq('label', 'ticker')
                          .maybeSingle();
                        
                        if (!existingTicker) {
                          const { error: tickerError } = await supabase
                            .from('brand_data_mappings')
                            .insert({
                              brand_id: brandId,
                              source: 'sec',
                              label: 'ticker',
                              external_id: tickerValue
                            });
                          
                          if (!tickerError) {
                            tickerAdded = true;
                            enrichmentMetrics.ticker_added = true;
                            console.log(`[enrich-brand-wiki] Added SEC ticker from parent: ${tickerValue}`);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            
            // Extract key people (CEO P169, Chairperson P488, Founder P112)
            // IMPORTANT: Store snake_case role names to match RPC function and UI expectations
            const keyPeopleProperties = {
              'P169': 'chief_executive_officer',  // CEO
              'P488': 'chairperson',              // Chairperson
              'P112': 'founder'                   // Founder
            };
            
            for (const [propId, role] of Object.entries(keyPeopleProperties)) {
              const peopleClaims = claims[propId] || [];
              
              for (const claim of peopleClaims.slice(0, 2)) { // Limit to 2 per role
                const personQid = claim.mainsnak?.datavalue?.value?.id;
                if (!personQid) continue;
                
                // Fetch person details
                const personEntityRes = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${personQid}.json`);
                if (personEntityRes.ok) {
                  const personData = await personEntityRes.json();
                  const personEntity = personData.entities?.[personQid];
                  const personName = personEntity?.labels?.en?.value;
                  
                  if (personName) {
                    // Get company ID (parent if exists, or create for brand)
                    let targetCompanyId = null;
                    
                    const { data: ownershipRel } = await supabase
                      .from('company_ownership')
                      .select('parent_company_id')
                      .eq('child_brand_id', brandId)
                      .eq('source', 'wikidata')
                      .maybeSingle();
                    
                    if (ownershipRel?.parent_company_id) {
                      targetCompanyId = ownershipRel.parent_company_id;
                    } else {
                      // Create company for brand itself
                      const { data: brandCompany } = await supabase
                        .from('companies')
                        .upsert({
                          name: targetName,
                          wikidata_qid: wikidata_qid
                        }, {
                          onConflict: 'wikidata_qid'
                        })
                        .select('id')
                        .single();
                      targetCompanyId = brandCompany?.id;
                    }
                    
                    if (targetCompanyId) {
                      // Get image if available (P18)
                      const imageClaim = personEntity?.claims?.['P18']?.[0];
                      const imageFile = imageClaim?.mainsnak?.datavalue?.value;
                      let imageUrl = null;
                      
                      if (imageFile) {
                        // Convert Wiki Commons filename to URL
                        const imageFilename = imageFile.replace(/ /g, '_');
                        imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${imageFilename}?width=300`;
                      }
                      
                      // Check if person already exists
                      const { data: existingPerson } = await supabase
                        .from('company_people')
                        .select('id')
                        .eq('company_id', targetCompanyId)
                        .eq('person_qid', personQid)
                        .maybeSingle();
                      
                      if (!existingPerson) {
                        // Insert key person with confidence scoring
                        const personConfidence = (personQid && imageUrl) ? 0.9 : (personQid ? 0.8 : 0.6);
                        
                        const { error: personError } = await supabase
                          .from('company_people')
                          .insert({
                            company_id: targetCompanyId,
                            person_name: personName,
                            person_qid: personQid,
                            role: role,
                            source: 'wikidata',
                            source_ref: `https://www.wikidata.org/wiki/${personQid}`,
                            image_url: imageUrl,
                            confidence: personConfidence
                          });
                        
                        if (!personError) {
                          keyPeopleAdded++;
                          enrichmentMetrics.people_added++;
                          console.log(`[enrich-brand-wiki] Added ${role}: ${personName} (confidence: ${personConfidence})`);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (enrichError) {
          console.error('[enrich-brand-wiki] Error enriching ownership/people:', enrichError);
          // Don't fail the whole operation if enrichment fails
        }
      }

      // Log enrichment run to database
      if (brandId) {
        try {
          const duration = Date.now() - startTime;
          enrichmentMetrics.parent_found = parentCompanyAdded;
          enrichmentMetrics.people_added = keyPeopleAdded;
          enrichmentMetrics.ticker_added = tickerAdded;
          enrichmentMetrics.description_length = description.length;
          
          await supabase.from('enrichment_runs').insert({
            brand_id: brandId,
            duration_ms: duration,
            ...enrichmentMetrics
          });
        } catch (logError) {
          console.error('[enrich-brand-wiki] Failed to log enrichment run:', logError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          updated: true,
          brand_id: brandId,
          target_table: targetTable,
          target_name: targetName,
          wikidata_qid,
          description_length: description.length,
          enrichment: {
            parent_company_added: parentCompanyAdded,
            key_people_added: keyPeopleAdded,
            ticker_added: tickerAdded
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enrich-brand-wiki] No Wikipedia description found for ${targetName}`);

    // Log failed enrichment attempt
    if (brandId) {
      try {
        const duration = Date.now() - startTime;
        enrichmentMetrics.error_message = "No Wikipedia description found";
        
        await supabase.from('enrichment_runs').insert({
          brand_id: brandId,
          duration_ms: duration,
          ...enrichmentMetrics
        });
      } catch (logError) {
        console.error('[enrich-brand-wiki] Failed to log enrichment run:', logError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        target: targetName,
        updated: false,
        note: "No Wikipedia description found"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[enrich-brand-wiki] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log error to enrichment_runs
    if (brandId) {
      try {
        const duration = Date.now() - startTime;
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        enrichmentMetrics.error_message = errorMessage;
        
        await supabase.from('enrichment_runs').insert({
          brand_id: brandId,
          duration_ms: duration,
          ...enrichmentMetrics
        });
      } catch (logError) {
        console.error('[enrich-brand-wiki] Failed to log enrichment run:', logError);
      }
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
