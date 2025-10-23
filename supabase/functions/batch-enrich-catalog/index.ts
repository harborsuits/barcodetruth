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
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { limit = 50, dry_run = false } = await req.json().catch(() => ({}));

    // Get all brands with Wikidata QIDs that need enrichment
    const { data: brands, error: fetchError } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid')
      .not('wikidata_qid', 'is', null)
      .eq('is_active', true)
      .eq('is_test', false)
      .order('name')
      .limit(limit);

    if (fetchError) throw fetchError;

    console.log(`[Batch Enrich] Found ${brands?.length || 0} brands to process`);

    const results = {
      total: brands?.length || 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ brand_id: string; brand_name: string; error: string }>,
      dry_run
    };

    if (dry_run) {
      return new Response(JSON.stringify({
        message: 'Dry run - no enrichment performed',
        brands_to_process: brands?.map(b => ({ id: b.id, name: b.name, wikidata_qid: b.wikidata_qid })),
        ...results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process each brand
    for (const brand of brands || []) {
      results.processed++;
      
      try {
        console.log(`[${results.processed}/${results.total}] Enriching ${brand.name} (${brand.wikidata_qid})`);

        // Call enrich-brand-wiki function
        const { data: enrichResult, error: enrichError } = await supabase.functions.invoke(
          'enrich-brand-wiki',
          {
            body: {
              brand_id: brand.id,
              wikidata_qid: brand.wikidata_qid,
              mode: 'full' // CRITICAL: Use full mode to get ownership + people
            }
          }
        );

        if (enrichError) {
          console.error(`[Error] ${brand.name}:`, enrichError);
          results.failed++;
          results.errors.push({
            brand_id: brand.id,
            brand_name: brand.name,
            error: enrichError.message || 'Unknown error'
          });
          continue;
        }

        // Small delay to avoid rate limiting Wikidata
        await new Promise(resolve => setTimeout(resolve, 500));
        
        results.succeeded++;
        console.log(`[Success] ${brand.name} enriched successfully`);

      } catch (error) {
        console.error(`[Error] ${brand.name}:`, error);
        results.failed++;
        results.errors.push({
          brand_id: brand.id,
          brand_name: brand.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[Batch Enrich] Complete: ${results.succeeded} succeeded, ${results.failed} failed`);

    return new Response(JSON.stringify({
      message: `Batch enrichment complete`,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Batch Enrich] Fatal error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
