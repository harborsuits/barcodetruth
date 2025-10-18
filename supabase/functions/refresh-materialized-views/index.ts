import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[Refresh Views] Starting refresh...");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Call the admin refresh function which has SECURITY DEFINER
    const { error } = await supabase.rpc("admin_refresh_coverage");
    
    if (error) {
      console.error("[Refresh Views] Error:", error);
      throw error;
    }

    console.log("[Refresh Views] Successfully refreshed materialized views");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Materialized views refreshed successfully" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (e: any) {
    console.error("[Refresh Views] Fatal error:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: String(e?.message || e)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
