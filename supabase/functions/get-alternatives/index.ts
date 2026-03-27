import { createClient } from "npm:@supabase/supabase-js@2";

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
    const { brand_id, limit = 12 } = await req.json();

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

    const better = (alternatives || []).filter((a: any) => a.alt_group === "better");
    const similar = (alternatives || []).filter((a: any) => a.alt_group === "similar");

    return new Response(
      JSON.stringify({
        alternatives: alternatives || [],
        groups: {
          better: better.slice(0, 6),
          similar: similar.slice(0, 6),
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
