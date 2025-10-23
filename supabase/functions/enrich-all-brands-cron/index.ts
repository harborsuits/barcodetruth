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

    // Get brands that need refresh (stale data or never enriched)
    const { data: brands, error: fetchError } = await supabase.rpc('get_next_brands_fair_rotation', {
      p_limit: 20 // Process 20 brands per run
    });

    if (fetchError) throw fetchError;

    console.log(`[Enrich Cron] Processing ${brands?.length || 0} brands`);

    let succeeded = 0;
    let failed = 0;

    for (const brand of brands || []) {
      try {
        // Get Wikidata QID
        const { data: brandData } = await supabase
          .from('brands')
          .select('wikidata_qid')
          .eq('id', brand.brand_id)
          .single();

        if (!brandData?.wikidata_qid) {
          console.log(`[Skip] ${brand.brand_name}: No Wikidata QID`);
          continue;
        }

        // Enrich the brand
        await supabase.functions.invoke('enrich-brand-wiki', {
          body: {
            brand_id: brand.brand_id,
            wikidata_qid: brandData.wikidata_qid,
            mode: 'full'
          }
        });

        succeeded++;
        console.log(`[Success] ${brand.brand_name} enriched`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        failed++;
        console.error(`[Error] ${brand.brand_name}:`, error);
      }
    }

    console.log(`[Enrich Cron] Complete: ${succeeded} succeeded, ${failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      processed: brands?.length || 0,
      succeeded,
      failed
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Enrich Cron] Fatal error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
