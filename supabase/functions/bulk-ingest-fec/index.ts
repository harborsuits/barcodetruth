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

    console.log("[bulk-ingest-fec] Starting bulk FEC ingestion...");

    const { data: pilots, error: pilotErr } = await supabase
      .from("pilot_brands")
      .select("brand_id, brands(name)")
      .limit(100);

    if (pilotErr) throw pilotErr;

    if (!pilots || pilots.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, note: "No pilot brands" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[bulk-ingest-fec] Processing ${pilots.length} pilot brands`);

    const results: Array<{ brand_id: string; name: string; success: boolean; error?: string }> = [];

    for (const pilot of pilots) {
      const brandId = pilot.brand_id;
      const brandName = (pilot.brands as any)?.name || "Unknown";

      try {
        const ingestUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fetch-fec-events?brand_id=${brandId}`;
        const response = await fetch(ingestUrl, {
          method: "POST",
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
        console.log(`[bulk-ingest-fec] ${brandName}: ${data.inserted || 0} new events`);

        results.push({ brand_id: brandId, name: brandName, success: true });
      } catch (error: any) {
        console.error(`[bulk-ingest-fec] Error for ${brandName}:`, error);
        results.push({ brand_id: brandId, name: brandName, success: false, error: error.message });
      }
    }

    const successful = results.filter((r) => r.success).length;

    console.log(`[bulk-ingest-fec] Complete: ${successful}/${results.length} succeeded`);

    return new Response(
      JSON.stringify({ success: true, total: results.length, successful, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[bulk-ingest-fec] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
