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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[bulk-calculate-scores] Starting bulk score calculation...");

    // Get brands with recent events (from coverage)
    // Note: Can't use embedded resources with materialized views, so we query separately
    const { data: brandsWithEvents, error: coverageErr } = await supabase
      .from("brand_data_coverage")
      .select("brand_id")
      .gt("events_30d", 0)
      .limit(100);

    if (coverageErr) throw coverageErr;

    // Get brand names separately
    const brandIds = brandsWithEvents?.map(b => b.brand_id) || [];
    const { data: brands } = await supabase
      .from("brands")
      .select("id, name")
      .in("id", brandIds);

    const brandMap = new Map(brands?.map(b => [b.id, b.name]) || []);

    if (!brandsWithEvents || brandsWithEvents.length === 0) {
      console.log("[bulk-calculate-scores] No brands with recent events");
      return new Response(
        JSON.stringify({ success: true, processed: 0, note: "No brands with events" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[bulk-calculate-scores] Processing ${brandsWithEvents.length} brands with events`);

    const results: Array<{ brand_id: string; name: string; success: boolean; error?: string }> = [];

    // Calculate score for each brand using simple-brand-scorer
    for (const item of brandsWithEvents) {
      const brandId = item.brand_id;
      const brandName = brandMap.get(brandId) || "Unknown";

      try {
        // Use simple-brand-scorer instead of complex calculate-brand-score
        const scoreUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/simple-brand-scorer`;
        const response = await fetch(scoreUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();
        console.log(`[bulk-calculate-scores] Processed all brands, successful: ${data.succeeded || 0}`);

        results.push({
          brand_id: brandId,
          name: brandName,
          success: true,
        });
        break; // simple-brand-scorer processes all brands at once
      } catch (error: any) {
        console.error(`[bulk-calculate-scores] Error:`, error);
        results.push({
          brand_id: brandId,
          name: brandName,
          success: false,
          error: error.message,
        });
        break;
      }
    }

    const successful = results.filter((r) => r.success).length;

    console.log(`[bulk-calculate-scores] Complete: ${successful}/${results.length} succeeded`);

    return new Response(
      JSON.stringify({ success: true, total: results.length, successful, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[bulk-calculate-scores] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
