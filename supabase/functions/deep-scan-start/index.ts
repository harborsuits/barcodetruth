import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "auth" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { brand_id } = await req.json();
    if (!brand_id) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "missing_brand_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load user plan (default to free if none)
    const { data: plan } = await supabase
      .from("user_plans")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const scansPerMonth = plan?.scans_per_month ?? 2;
    const userPlan = plan?.plan ?? 'free';

    // Get usage this month using helper function
    const { data: usageData, error: usageError } = await supabase
      .rpc("get_scans_used_month", { p_user: user.id });

    const scansUsed = usageData ?? 0;

    console.log(`[deep-scan-start] User ${user.id}, plan: ${userPlan}, used: ${scansUsed}/${scansPerMonth}`);

    if (scansUsed >= scansPerMonth) {
      const nextReset = new Date();
      nextReset.setMonth(nextReset.getMonth() + 1, 1);
      nextReset.setHours(0, 0, 0, 0);

      return new Response(
        JSON.stringify({ 
          allowed: false, 
          reason: "quota_exceeded",
          scans_used: scansUsed,
          scans_per_month: scansPerMonth,
          next_reset: nextReset.toISOString()
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cooldown check: 6 hours for same brand (unless pro)
    if (userPlan !== 'pro') {
      const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("user_scans")
        .select("id, status, completed_at")
        .eq("user_id", user.id)
        .eq("brand_id", brand_id)
        .gte("started_at", sixHoursAgo)
        .order("started_at", { ascending: false })
        .limit(1);

      if (recent && recent.length > 0) {
        return new Response(
          JSON.stringify({ 
            allowed: false, 
            reason: "cooldown",
            message: "Please wait 6 hours between scans of the same brand"
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create scan record
    const { data: scan, error: insertError } = await supabase
      .from("user_scans")
      .insert({
        user_id: user.id,
        brand_id,
        status: "queued",
        dedupe_key: `${brand_id}_${new Date().toISOString().split('T')[0]}`
      })
      .select("id")
      .single();

    if (insertError || !scan) {
      console.error("[deep-scan-start] Insert error:", insertError);
      return new Response(
        JSON.stringify({ allowed: false, reason: "insert_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[deep-scan-start] Created scan ${scan.id} for brand ${brand_id}`);

    // Fire runner async (don't await)
    supabase.functions.invoke("deep-scan-runner", {
      body: { scan_id: scan.id }
    }).catch(err => console.error("[deep-scan-start] Runner invoke error:", err));

    return new Response(
      JSON.stringify({
        allowed: true,
        scan_id: scan.id,
        status: "queued"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[deep-scan-start] Error:", error);
    return new Response(
      JSON.stringify({ allowed: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
