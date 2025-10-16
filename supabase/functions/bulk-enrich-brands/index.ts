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

    console.log("[bulk-enrich-brands] Starting bulk enrichment...");

    // Get all brands without Wikipedia descriptions
    const { data: brands, error: brandsErr } = await supabase
      .from("brands")
      .select("id, name")
      .or('description.is.null,description_source.neq.wikipedia')
      .limit(100);

    if (brandsErr) throw brandsErr;

    if (!brands || brands.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, note: "All brands already enriched" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[bulk-enrich-brands] Processing ${brands.length} brands`);

    const results: Array<{ brand_id: string; name: string; success: boolean; error?: string }> = [];

    for (const brand of brands) {
      try {
        const enrichUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-brand-wiki?brand_id=${brand.id}`;
        const response = await fetch(enrichUrl, {
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
        console.log(`[bulk-enrich-brands] ${brand.name}: ${data.updated ? 'enriched' : 'skipped'}`);

        results.push({ brand_id: brand.id, name: brand.name, success: true });

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error: any) {
        console.error(`[bulk-enrich-brands] Error for ${brand.name}:`, error);
        results.push({ brand_id: brand.id, name: brand.name, success: false, error: error.message });
      }
    }

    const successful = results.filter((r) => r.success).length;

    console.log(`[bulk-enrich-brands] Complete: ${successful}/${results.length} succeeded`);

    return new Response(
      JSON.stringify({ success: true, total: results.length, successful, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[bulk-enrich-brands] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
