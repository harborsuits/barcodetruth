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

  const t0 = performance.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // Quick DB ping
    const { error: dbError } = await supabase
      .from("brands")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (dbError) {
      throw new Error(`DB check failed: ${dbError.message}`);
    }

    // Ping get-brand-proof with a known brand (optional - comment out if no seed data)
    // const proofUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/get-brand-proof?brandId=<known-brand-id>`;
    // const proofRes = await fetch(proofUrl, {
    //   headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")! }
    // });
    // if (!proofRes.ok) throw new Error("get-brand-proof check failed");

    const dur = Math.round(performance.now() - t0);

    console.log(JSON.stringify({
      level: "info",
      fn: "health",
      dur_ms: dur,
      ok: true
    }));

    return new Response(
      JSON.stringify({ 
        ok: true, 
        checks: { db: "pass" },
        latency_ms: dur
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (e: any) {
    const dur = Math.round(performance.now() - t0);
    
    console.error(JSON.stringify({
      level: "error",
      fn: "health",
      msg: String(e?.message || e),
      dur_ms: dur
    }));

    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: String(e?.message || e),
        latency_ms: dur
      }),
      { 
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
