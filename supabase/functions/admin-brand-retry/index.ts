import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const { action, brand_ids } = await req.json();

    if (!action || !brand_ids || !Array.isArray(brand_ids) || brand_ids.length === 0) {
      return new Response(JSON.stringify({ error: "Missing action or brand_ids" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updatedCount = 0;

    switch (action) {
      case "retry_now":
        // Reset brand to stub with immediate retry
        const { count: retryCount } = await supabase
          .from("brands")
          .update({
            status: "stub",
            enrichment_attempts: 0,
            enrichment_error: null,
            next_enrichment_at: new Date().toISOString(),
            enrichment_stage: null,
            enrichment_stage_updated_at: null,
            enrichment_started_at: null,
            updated_at: new Date().toISOString(),
          })
          .in("id", brand_ids);
        updatedCount = retryCount || 0;
        break;

      case "reset_to_stub":
        // Same as retry_now but explicit naming
        const { count: resetCount } = await supabase
          .from("brands")
          .update({
            status: "stub",
            enrichment_attempts: 0,
            enrichment_error: null,
            next_enrichment_at: new Date().toISOString(),
            enrichment_stage: null,
            enrichment_stage_updated_at: null,
            enrichment_started_at: null,
            updated_at: new Date().toISOString(),
          })
          .in("id", brand_ids);
        updatedCount = resetCount || 0;
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    console.log(`[admin-brand-retry] ${action} on ${brand_ids.length} brands, updated ${updatedCount}`);

    return new Response(JSON.stringify({
      success: true,
      action,
      requested: brand_ids.length,
      updated: updatedCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[admin-brand-retry] Error: ${errorMessage}`);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
