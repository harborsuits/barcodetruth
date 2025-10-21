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

    const url = new URL(req.url);
    const brandId = url.searchParams.get('brand_id');
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

    // Step 2: Get Wikipedia page title from Wikidata
    let wikipediaTitle = null;
    if (wikidata_qid) {
      console.log(`[enrich-brand-wiki] Fetching Wikipedia title from Wikidata ${wikidata_qid}`);
      const wikidataEntityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidata_qid}&format=json&props=sitelinks`;
      
      const entityRes = await fetch(wikidataEntityUrl);
      if (entityRes.ok) {
        const entityJson = await entityRes.json();
        const entity = entityJson.entities?.[wikidata_qid];
        wikipediaTitle = entity?.sitelinks?.enwiki?.title;
        console.log(`[enrich-brand-wiki] Wikipedia title: ${wikipediaTitle}`);
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
        return new Response(
          JSON.stringify({ error: `Failed to update ${targetTable}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[enrich-brand-wiki] ✅ Updated ${targetTable} ${targetName} with Wikipedia description`);

      return new Response(
        JSON.stringify({ 
          success: true,
          brand_id: brandId,
          target_table: targetTable,
          target_name: targetName,
          updated: true,
          wikidata_qid,
          description_length: description.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enrich-brand-wiki] No Wikipedia description found for ${targetName}`);

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
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
