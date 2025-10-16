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
    const { action } = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    
    const isAdmin = roles?.some(r => r.role === "admin");
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[trigger-enrichment] Admin ${user.id} triggering ${action}`);

    let result;
    switch (action) {
      case "enrich-brands":
        result = await supabase.functions.invoke("bulk-enrich-brands", { body: {} });
        break;
      case "generate-summaries":
        result = await supabase.functions.invoke("generate-event-summaries", { body: {} });
        break;
      case "ingest-all":
        const [fda, epa, osha, fec] = await Promise.all([
          supabase.functions.invoke("bulk-ingest-fda", { body: {} }),
          supabase.functions.invoke("bulk-ingest-epa", { body: {} }),
          supabase.functions.invoke("bulk-ingest-osha", { body: {} }),
          supabase.functions.invoke("bulk-ingest-fec", { body: {} }),
        ]);
        result = { data: { fda: fda.data, epa: epa.data, osha: osha.data, fec: fec.data } };
        break;
      case "calculate-scores":
        result = await supabase.functions.invoke("bulk-calculate-scores", { body: {} });
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`[trigger-enrichment] ${action} result:`, result.data);

    return new Response(
      JSON.stringify({ success: true, result: result.data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[trigger-enrichment] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
