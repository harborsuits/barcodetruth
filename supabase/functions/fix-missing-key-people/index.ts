/**
 * fix-missing-key-people
 * 
 * Calls enrich-brand-wiki with mode:'full' for brands that have
 * company ownership but no key people data.
 * 
 * This is a ONE-TIME fix for the system-wide heal skip bug.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Fix Key People] Starting...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find brands with ownership but no key people
    const { data: brands, error: queryError } = await supabase.rpc('get_brands_missing_key_people');
    
    if (queryError) throw queryError;
    
    if (!brands || brands.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All brands have key people data!' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Fix Key People] Found ${brands.length} brands to enrich`);

    let processed = 0;
    let enriched = 0;
    let failed = 0;
    const results: any[] = [];

    for (const brand of brands) {
      try {
        console.log(`[${processed + 1}/${brands.length}] Enriching: ${brand.name}`);

        const enrichResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/enrich-brand-wiki`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              brand_id: brand.id,
              wikidata_qid: brand.wikidata_qid,
              mode: 'full'
            }),
          }
        );

        if (!enrichResponse.ok) {
          const errorText = await enrichResponse.text();
          console.error(`  ✗ Failed: ${errorText}`);
          failed++;
          results.push({ 
            brand: brand.name, 
            status: 'failed', 
            error: errorText 
          });
        } else {
          const enrichData = await enrichResponse.json();
          console.log(`  ✓ Success`);
          enriched++;
          results.push({ 
            brand: brand.name, 
            status: 'success',
            people_added: enrichData.full_enrichment_completed 
          });
        }

        processed++;

        // Rate limit: 500ms between calls
        await new Promise(r => setTimeout(r, 500));

      } catch (error: any) {
        console.error(`  ✗ Error: ${error.message}`);
        failed++;
        results.push({ 
          brand: brand.name, 
          status: 'error', 
          error: error.message 
        });
        processed++;
      }
    }

    console.log('[Fix Key People] ========================================');
    console.log('[Fix Key People] ✅ COMPLETE');
    console.log(`[Fix Key People] Processed: ${processed}`);
    console.log(`[Fix Key People] Enriched: ${enriched}`);
    console.log(`[Fix Key People] Failed: ${failed}`);
    console.log('[Fix Key People] ========================================');

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: processed,
          enriched,
          failed
        },
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Fix Key People] FATAL ERROR:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});