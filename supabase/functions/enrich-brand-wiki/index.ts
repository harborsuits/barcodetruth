import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Feature flag enforcement
const ENRICH_MODE = Deno.env.get('ENRICH_BRAND_WIKI_MODE') || 'desc-only';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Enforce desc-only mode
  if (ENRICH_MODE !== 'desc-only') {
    return new Response(
      JSON.stringify({ error: 'enrich-brand-wiki must run in desc-only mode (ownership/people removed)' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const startTime = Date.now();
  let brandId: string | null = null;
  let rowsWritten = 0;
  let status = 'success';
  let errorMsg: string | null = null;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    brandId = url.searchParams.get('brand_id');
    const mode = url.searchParams.get('mode');
    
    // Batch mode
    if (mode === 'missing') {
      console.log('[enrich-brand-wiki] Batch mode: processing brands missing descriptions');
      
      const { data: brands, error: fetchError } = await supabase
        .from('brands')
        .select('id, name')
        .is('description', null)
        .eq('is_active', true)
        .limit(50); // Increased from 10
      
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
          const enrichUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-brand-wiki?brand_id=${brand.id}`;
          await fetch(enrichUrl, {
            headers: { 'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` }
          });
          processed++;
          await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
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

    // Get brand data
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid, description, description_source')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      errorMsg = 'Brand not found';
      status = 'failed';
      throw new Error(errorMsg);
    }

    // Skip if already has Wikipedia description
    if (brand.description && brand.description_source === 'wikipedia') {
      console.log(`[enrich-brand-wiki] Brand already has Wikipedia description`);
      
      // Log enrichment run
      await supabase.from('enrichment_runs').insert({
        brand_id: brandId,
        task: 'wiki',
        rows_written: 0,
        status: 'success',
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });

      return new Response(
        JSON.stringify({ success: true, note: "Already has Wikipedia description" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let description: string | null = null;
    let wikidata_qid = brand.wikidata_qid;
    let wiki_en_title: string | null = null;

    // Step 1: Search Wikidata if no QID
    if (!wikidata_qid) {
      console.log(`[enrich-brand-wiki] Searching Wikidata for: ${brand.name}`);
      
      const searchQueries = [
        `${brand.name} company`,
        `${brand.name} brand`,
        `${brand.name} corporation`,
        brand.name
      ];
      
      for (const query of searchQueries) {
        if (wikidata_qid) break;
        
        const wikidataSearchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=5&type=item`;
        
        const wikidataRes = await fetch(wikidataSearchUrl);
        if (wikidataRes.ok) {
          const wikidataJson = await wikidataRes.json();
          
          if (wikidataJson.search && wikidataJson.search.length > 0) {
            const filtered = wikidataJson.search.filter((result: any) => {
              const desc = (result.description || '').toLowerCase();
              
              if (desc.includes('disambiguation') || desc.includes('surname') || 
                  desc.includes('given name') || desc.includes('village') || 
                  desc.includes('town') || desc.includes('tournament')) {
                return false;
              }
              
              return desc.includes('company') || desc.includes('brand') || 
                     desc.includes('corporation') || desc.includes('business') || 
                     !result.description;
            });
            
            if (filtered.length > 0) {
              wikidata_qid = filtered[0].id;
              console.log(`[enrich-brand-wiki] Found QID: ${wikidata_qid}`);
              break;
            }
          }
        }
      }
    }

    // Step 2: Get enwiki sitelink from Wikidata
    if (wikidata_qid) {
      console.log(`[enrich-brand-wiki] Fetching Wikidata entity ${wikidata_qid}`);
      const wikidataEntityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidata_qid}&format=json&props=sitelinks`;
      
      const entityRes = await fetch(wikidataEntityUrl);
      if (entityRes.ok) {
        const entityJson = await entityRes.json();
        const entity = entityJson.entities?.[wikidata_qid];
        wiki_en_title = entity?.sitelinks?.enwiki?.title;
        console.log(`[enrich-brand-wiki] Wikipedia title: ${wiki_en_title}`);
      }
    }
    
    // Step 3: Fallback to direct Wikipedia search
    if (!wiki_en_title) {
      console.log(`[enrich-brand-wiki] Searching Wikipedia directly for: ${brand.name}`);
      const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(brand.name)}&limit=1&format=json`;
      
      const wikiSearchRes = await fetch(wikiSearchUrl);
      if (wikiSearchRes.ok) {
        const wikiSearchJson = await wikiSearchRes.json();
        if (wikiSearchJson[1] && wikiSearchJson[1].length > 0) {
          wiki_en_title = wikiSearchJson[1][0];
          console.log(`[enrich-brand-wiki] Found Wikipedia title: ${wiki_en_title}`);
        }
      }
    }

    // Step 4: Get Wikipedia extract
    if (wiki_en_title) {
      console.log(`[enrich-brand-wiki] Fetching extract for: ${wiki_en_title}`);
      const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(wiki_en_title)}&format=json`;
      
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

    // Step 5: Validate and update
    if (description && description.length >= 40) {
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
        errorMsg = `Failed to update brand: ${updateError.message}`;
        status = 'failed';
        throw updateError;
      }

      rowsWritten = 1;
      console.log(`[enrich-brand-wiki] ✅ Updated brand with Wikipedia description`);
    } else if (description && description.length < 40) {
      // Description too short, flag for review
      status = 'partial';
      errorMsg = `Description too short (${description.length} chars)`;
      console.log(`[enrich-brand-wiki] ⚠️ Description too short, skipping`);
    } else {
      status = 'failed';
      errorMsg = 'No description found';
      console.log(`[enrich-brand-wiki] ❌ No description found`);
    }

    // Log enrichment run
    await supabase.from('enrichment_runs').insert({
      brand_id: brandId,
      task: 'wiki',
      rows_written: rowsWritten,
      status,
      error: errorMsg,
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime
    });

    return new Response(
      JSON.stringify({ 
        success: status === 'success', 
        rows_written: rowsWritten,
        status,
        error: errorMsg,
        wikidata_qid,
        wiki_en_title
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[enrich-brand-wiki] Error:', error);
    
    // Log failed run
    if (brandId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase.from('enrichment_runs').insert({
          brand_id: brandId,
          task: 'wiki',
          rows_written: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          started_at: new Date(startTime).toISOString(),
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        });
      } catch {}
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
