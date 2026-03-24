import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batch_size || 50, 100);
    const dryRun = body.dry_run ?? false;

    // 1. Get the activation queue ranked by proximity
    const { data: queue, error: qErr } = await supabase.rpc(
      "get_activation_queue",
      { batch_size: batchSize }
    );
    if (qErr) throw qErr;

    // 2. Get blocker summary
    const { data: blockers, error: bErr } = await supabase.rpc(
      "get_activation_blockers"
    );
    if (bErr) throw bErr;

    if (dryRun) {
      return new Response(
        JSON.stringify({
          mode: "dry_run",
          queue_size: queue.length,
          top_brands: queue.slice(0, 20).map((b: any) => ({
            name: b.brand_name,
            events: b.event_count,
            tier: b.tier,
            proximity: b.proximity_score,
            missing: {
              description: !b.has_description,
              logo: !b.has_logo,
              parent: !b.has_parent,
            },
          })),
          blockers,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Enrich each brand in the batch
    const results = {
      logos_resolved: 0,
      wiki_enriched: 0,
      promoted: 0,
      errors: [] as string[],
    };

    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    for (const brand of queue) {
      try {
        // Resolve logo if missing
        if (!brand.has_logo) {
          const logoRes = await fetch(
            `${baseUrl}/functions/v1/resolve-brand-logo`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ brand_id: brand.brand_id }),
            }
          );
          if (logoRes.ok) results.logos_resolved++;
        }

        // Enrich wiki description if missing
        if (!brand.has_description) {
          const wikiRes = await fetch(
            `${baseUrl}/functions/v1/enrich-brand-wiki`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ brand_id: brand.brand_id }),
            }
          );
          if (wikiRes.ok) results.wiki_enriched++;
        }
      } catch (e: any) {
        results.errors.push(`${brand.brand_name}: ${e.message}`);
      }
    }

    // 4. Run promotion check
    const { data: promoted, error: pErr } = await supabase.rpc(
      "promote_eligible_brands"
    );
    if (!pErr && promoted) {
      results.promoted = promoted;
    }

    // 5. Get updated counts
    const { count: activeCount } = await supabase
      .from("brands")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    const { count: readyCount } = await supabase
      .from("brands")
      .select("*", { count: "exact", head: true })
      .eq("status", "ready");

    return new Response(
      JSON.stringify({
        mode: "executed",
        batch_processed: queue.length,
        results,
        current_state: {
          active: activeCount,
          ready: readyCount,
        },
        blockers,
        next_closest: queue
          .filter((b: any) => b.tier === "near_ready")
          .map((b: any) => b.brand_name),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
