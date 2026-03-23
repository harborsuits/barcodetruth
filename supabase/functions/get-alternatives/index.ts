import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand_id, type = "smart", limit = 12 } = await req.json();

    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: "brand_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Use the smart alternatives RPC which handles:
    // - Same category filtering
    // - Parent company exclusion
    // - Independence scoring bonus
    // - Grouping (independent / local / mainstream)
    const { data: alternatives, error } = await supabase.rpc("get_smart_alternatives", {
      p_brand_id: brand_id,
      p_limit: Math.min(limit, 20),
    });

    if (error) {
      console.error("get_smart_alternatives error:", error);
      return new Response(
        JSON.stringify({ alternatives: [], error: error.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group alternatives for UI
    const independent = (alternatives || []).filter((a: any) => a.alt_group === "independent");
    const mainstream = (alternatives || []).filter((a: any) => a.alt_group === "mainstream");

    return new Response(
      JSON.stringify({
        alternatives: alternatives || [],
        groups: {
          independent: independent.slice(0, 5),
          mainstream: mainstream.slice(0, 5),
        },
        source: "smart_rpc",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("get-alternatives error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", alternatives: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
