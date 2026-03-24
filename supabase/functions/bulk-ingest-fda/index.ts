import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse optional body
    let batchSize = 50;
    let tierFilter = 'all'; // 'near_ready' | 'fast_follow' | 'all'
    try {
      const body = await req.json();
      if (body.batch_size) batchSize = Math.min(body.batch_size, 100);
      if (body.tier) tierFilter = body.tier;
    } catch { /* no body is fine */ }

    console.log(`[bulk-ingest-fda] Starting — batch_size=${batchSize}, tier=${tierFilter}`);

    // Get activation queue brands (ranked by proximity score)
    const { data: queue, error: queueErr } = await supabase
      .rpc('get_activation_queue', { batch_size: batchSize });

    if (queueErr) {
      console.error('[bulk-ingest-fda] Queue error:', queueErr);
      throw queueErr;
    }

    if (!queue || queue.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, note: "No brands in activation queue" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter by tier if requested
    let targets = queue;
    if (tierFilter === 'near_ready') {
      targets = queue.filter((b: any) => b.event_count >= 4);
    } else if (tierFilter === 'fast_follow') {
      targets = queue.filter((b: any) => b.event_count >= 2 && b.event_count < 4);
    }

    console.log(`[bulk-ingest-fda] Processing ${targets.length} brands from activation queue`);

    const results: Array<{ brand_id: string; name: string; inserted: number; success: boolean; error?: string }> = [];

    for (const brand of targets) {
      try {
        const ingestUrl = `${supabaseUrl}/functions/v1/ingest-fda-recalls?brand_id=${brand.brand_id}`;
        const response = await fetch(ingestUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();
        const inserted = data.inserted || 0;
        console.log(`[bulk-ingest-fda] ${brand.brand_name}: ${inserted} new events (${data.endpoints_searched?.join(',') || 'all'})`);

        results.push({
          brand_id: brand.brand_id,
          name: brand.brand_name,
          inserted,
          success: true,
        });

        // Brief pause between brands
        await new Promise(r => setTimeout(r, 300));
      } catch (error: any) {
        console.error(`[bulk-ingest-fda] Error for ${brand.brand_name}:`, error);
        results.push({
          brand_id: brand.brand_id,
          name: brand.brand_name,
          inserted: 0,
          success: false,
          error: error.message,
        });
      }
    }

    // After all ingestion, run promotion
    console.log('[bulk-ingest-fda] Running promote_eligible_brands()...');
    const { data: promoted, error: promoteErr } = await supabase.rpc('promote_eligible_brands');
    if (promoteErr) {
      console.error('[bulk-ingest-fda] Promotion error:', promoteErr);
    } else {
      console.log(`[bulk-ingest-fda] Promoted ${promoted || 0} brands to active`);
    }

    const successful = results.filter(r => r.success).length;
    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);

    console.log(`[bulk-ingest-fda] Complete: ${successful}/${results.length} brands, ${totalInserted} total events inserted, ${promoted || 0} promoted`);

    return new Response(
      JSON.stringify({
        success: true,
        total_brands: results.length,
        successful,
        failed: results.length - successful,
        total_events_inserted: totalInserted,
        brands_promoted: promoted || 0,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[bulk-ingest-fda] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
