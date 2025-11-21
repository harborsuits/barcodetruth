import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[enrich-top-brands] Starting enrichment for all brands');

    // Get ALL brands with valid QIDs that need enrichment
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid, last_enriched_at')
      .eq('is_active', true)
      .not('wikidata_qid', 'is', null)
      .order('last_enriched_at', { ascending: true, nullsFirst: true }); // Process unenriched first

    if (brandsError) throw brandsError;

    console.log(`[enrich-top-brands] Found ${brands.length} brands to enrich`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const BATCH_SIZE = 20;

    // Process in batches
    for (let i = 0; i < brands.length; i += BATCH_SIZE) {
      const batch = brands.slice(i, i + BATCH_SIZE);
      console.log(`[enrich-top-brands] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(brands.length / BATCH_SIZE)}`);
      
      for (const brand of batch) {
        // Skip if enriched in last 7 days
        if (brand.last_enriched_at) {
          const lastEnriched = new Date(brand.last_enriched_at);
          const daysSince = (Date.now() - lastEnriched.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < 7) {
            console.log(`[enrich-top-brands] Skipping ${brand.name} - enriched ${Math.floor(daysSince)} days ago`);
            skippedCount++;
            continue;
          }
        }
        
        console.log(`[enrich-top-brands] Enriching ${brand.name} (${brand.wikidata_qid})`);
        
        try {
          // Call enrich-brand-wiki function
          const { data, error } = await supabase.functions.invoke('enrich-brand-wiki', {
            body: {
              brand_id: brand.id,
              wikidata_qid: brand.wikidata_qid,
              mode: 'full'
            }
          });

          if (error) {
            console.error(`[enrich-top-brands] Error enriching ${brand.name}:`, error);
            results.push({
              brand: brand.name,
              brand_id: brand.id,
              success: false,
              error: error.message
            });
            errorCount++;
          } else {
            console.log(`[enrich-top-brands] Successfully enriched ${brand.name}`);
            
            // Mark as enriched
            await supabase
              .from('brands')
              .update({ last_enriched_at: new Date().toISOString() })
              .eq('id', brand.id);
            
            results.push({
              brand: brand.name,
              brand_id: brand.id,
              success: true,
              data: data
            });
            successCount++;
          }

          // Wait 2 seconds between calls to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          console.error(`[enrich-top-brands] Exception enriching ${brand.name}:`, error);
          results.push({
            brand: brand.name,
            brand_id: brand.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          errorCount++;
        }
      }
    }

    console.log(`[enrich-top-brands] Complete: ${successCount} success, ${errorCount} errors, ${skippedCount} skipped`);

    // Trigger score recalculation for successfully enriched brands
    const enrichedIds = results.filter(r => r.success).map(r => r.brand_id);
    if (enrichedIds.length > 0) {
      console.log(`[enrich-top-brands] Triggering score recalculation for ${enrichedIds.length} brands`);
      await supabase.functions.invoke('recompute-brand-scores', {
        body: { brand_ids: enrichedIds }
      });
    }

    return new Response(
      JSON.stringify({
        total_brands: brands.length,
        processed: results.length,
        success_count: successCount,
        error_count: errorCount,
        skipped_count: skippedCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[enrich-top-brands] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
