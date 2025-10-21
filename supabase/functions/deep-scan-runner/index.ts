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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { scan_id } = await req.json();
    if (!scan_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing scan_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load scan record
    const { data: scan, error: scanError } = await admin
      .from("user_scans")
      .select("*")
      .eq("id", scan_id)
      .single();

    if (scanError || !scan) {
      console.error(`[deep-scan-runner] Scan not found: ${scanError?.message}`);
      return new Response(
        JSON.stringify({ ok: false, error: "Scan not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allow queued or running status (in case of retry)
    if (scan.status !== "queued" && scan.status !== "running") {
      console.error(`[deep-scan-runner] Invalid scan status: ${scan.status}`);
      return new Response(
        JSON.stringify({ ok: false, error: `Invalid scan status: ${scan.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[deep-scan-runner] Starting scan ${scan_id} for brand ${scan.brand_id}`);

    // Update to running with timestamp
    await admin
      .from("user_scans")
      .update({ 
        status: "running",
        started_at: new Date().toISOString()
      })
      .eq("id", scan_id);

    try {
      // Fetch brand details
      const { data: brand, error: brandError } = await admin
        .from("brands")
        .select("id, name, aliases, parent_company")
        .eq("id", scan.brand_id)
        .single();

      if (brandError || !brand) {
        throw new Error(`Brand not found: ${brandError?.message}`);
      }

      console.log(`[deep-scan-runner] Brand: ${brand.name}`);

      // Call unified-news-orchestrator with brand-specific parameters (with timeout)
      const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/unified-news-orchestrator`;
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 45000);

      let newEventsCount = 0;
      try {
        const resp = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            'apikey': Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            brand_id: brand.id,
            brand_name: brand.name,
            max_articles: 40,
            mode: 'deep_scan'
          }),
          signal: ctrl.signal
        });
        clearTimeout(timeout);

        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`Orchestrator HTTP ${resp.status}: ${txt}`);
        }
        const orchestratorResult = await resp.json();
        newEventsCount = orchestratorResult?.new_events || 0;
      } catch (err) {
        if ((err as any).name === 'AbortError') {
          throw new Error('Orchestrator timed out');
        }
        throw err;
      }
      console.log(`[deep-scan-runner] Found ${newEventsCount} new events`);

      // Refresh brand monitoring status
      await admin.rpc("refresh_materialized_views");

      // Mark as success
      await admin
        .from("user_scans")
        .update({
          status: "success",
          result_count: newEventsCount,
          completed_at: new Date().toISOString()
        })
        .eq("id", scan_id);

      console.log(`[deep-scan-runner] Completed scan ${scan_id}`);

      return new Response(
        JSON.stringify({ ok: true, result_count: newEventsCount }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (error) {
      console.error(`[deep-scan-runner] Error:`, error);
      
      // Mark as error
      await admin
        .from("user_scans")
        .update({
          status: "error",
          error_message: String(error),
          completed_at: new Date().toISOString()
        })
        .eq("id", scan_id);

      return new Response(
        JSON.stringify({ ok: false, error: String(error) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("[deep-scan-runner] Fatal error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
