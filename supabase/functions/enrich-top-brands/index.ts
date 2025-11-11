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

    console.log('[enrich-top-brands] Starting enrichment for top brands');

    // Get top 50 brands with QIDs
    // Using a combination of factors: has QID, is active, ordered by name for now
    // TODO: Add view_count or popularity metric to brands table
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid')
      .eq('is_active', true)
      .not('wikidata_qid', 'is', null)
      .order('name')
      .limit(50);

    if (brandsError) throw brandsError;

    console.log(`[enrich-top-brands] Found ${brands.length} brands to enrich`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const brand of brands) {
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
          error: error.message
        });
        errorCount++;
      }
    }

    console.log(`[enrich-top-brands] Complete: ${successCount} success, ${errorCount} errors`);

    // Trigger score recalculation for all enriched brands
    console.log('[enrich-top-brands] Triggering score recalculation');
    await supabase.functions.invoke('recompute-brand-scores', {
      body: { brand_ids: brands.map(b => b.id) }
    });

    return new Response(
      JSON.stringify({
        processed: results.length,
        success_count: successCount,
        error_count: errorCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[enrich-top-brands] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
