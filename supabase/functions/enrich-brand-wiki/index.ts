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

    // Get brand
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid, description, description_source')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      console.error('[enrich-brand-wiki] Brand not found:', brandError);
      return new Response(
        JSON.stringify({ error: "Brand not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if already has Wikipedia description
    if (brand.description && brand.description_source === 'wikipedia') {
      console.log(`[enrich-brand-wiki] Brand ${brand.name} already has Wikipedia description`);
      return new Response(
        JSON.stringify({ 
          success: true,
          brand: brand.name,
          note: "Already has Wikipedia description"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let description = null;
    let wikidata_qid = brand.wikidata_qid;

    // Step 1: Search Wikidata for the brand if we don't have QID
    if (!wikidata_qid) {
      console.log(`[enrich-brand-wiki] Searching Wikidata for: ${brand.name}`);
      
      // Improve search by adding context - try multiple queries
      const searchQueries = [
        `${brand.name} company`,
        `${brand.name} brand`,
        `${brand.name} food company`,
        brand.name
      ];
      
      for (const query of searchQueries) {
        const wikidataSearchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=3&type=item`;
        
        const wikidataRes = await fetch(wikidataSearchUrl);
        if (wikidataRes.ok) {
          const wikidataJson = await wikidataRes.json();
          if (wikidataJson.search && wikidataJson.search.length > 0) {
            // Filter results to prefer companies/brands over people/surnames
            const filtered = wikidataJson.search.filter((result: any) => {
              const desc = (result.description || '').toLowerCase();
              // Exclude people, surnames, given names
              if (desc.includes('surname') || desc.includes('given name') || 
                  desc.includes('person') || desc.includes('people')) {
                return false;
              }
              // Prefer companies, brands, products
              return desc.includes('company') || desc.includes('brand') || 
                     desc.includes('business') || desc.includes('corporation') ||
                     desc.includes('product') || !result.description;
            });
            
            if (filtered.length > 0) {
              wikidata_qid = filtered[0].id;
              console.log(`[enrich-brand-wiki] Found Wikidata QID with query "${query}": ${wikidata_qid} - ${filtered[0].description}`);
              break;
            }
          }
        }
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
      console.log(`[enrich-brand-wiki] Searching Wikipedia directly for: ${brand.name}`);
      const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(brand.name)}&limit=1&format=json`;
      
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

    // Step 5: Update brand if we got description
    if (description) {
      const updates: any = {
        description,
        description_source: 'wikipedia',
        description_lang: 'en'
      };
      
      if (wikidata_qid && !brand.wikidata_qid) {
        updates.wikidata_qid = wikidata_qid;
      }

      const { error: updateError } = await supabase
        .from('brands')
        .update(updates)
        .eq('id', brandId);

      if (updateError) {
        console.error('[enrich-brand-wiki] Update error:', updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update brand" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[enrich-brand-wiki] ✅ Updated brand ${brand.name} with Wikipedia description`);

      return new Response(
        JSON.stringify({ 
          success: true,
          brand: brand.name,
          updated: true,
          wikidata_qid,
          description_length: description.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enrich-brand-wiki] No Wikipedia description found for ${brand.name}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        brand: brand.name,
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
