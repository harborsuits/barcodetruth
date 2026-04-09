// Brand Rotation Scheduler
// Runs twice daily, picks 15-20 brands by priority (oldest + largest first),
// calls unified-news-orchestrator for each, then updates last_news_ingestion.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 18; // fits within free-tier API budgets (2 runs × 18 = 36/day)
const COOLDOWN_MS = 15 * 60 * 1000; // 15-minute cooldown between runs

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Cooldown check — prevent overlapping runs
    const { data: lastRun } = await supabase
      .from("cron_runs")
      .select("last_run")
      .eq("fn", "rotate-brand-ingestion")
      .maybeSingle();

    if (lastRun?.last_run) {
      const elapsed = Date.now() - new Date(lastRun.last_run).getTime();
      if (elapsed < COOLDOWN_MS) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "cooldown", retry_after_s: Math.ceil((COOLDOWN_MS - elapsed) / 1000) }),
          { status: 429, headers }
        );
      }
    }

    // Mark run start
    await supabase.from("cron_runs").upsert({ fn: "rotate-brand-ingestion", last_run: new Date().toISOString() });

    // Pick next batch: priority-weighted, oldest-first
    const { data: brands, error: brandErr } = await supabase
      .from("brands")
      .select("id, name, company_size, last_news_ingestion")
      .eq("is_active", true)
      .order("last_news_ingestion", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE * 3); // fetch extra so we can priority-sort

    if (brandErr) throw brandErr;
    if (!brands || brands.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No active brands", processed: 0 }), { headers });
    }

    // Priority sort: fortune_500 > large > medium > rest, then by oldest ingestion
    const priorityMap: Record<string, number> = { fortune_500: 1, large: 2, medium: 3 };
    const sorted = brands.sort((a, b) => {
      const pa = priorityMap[a.company_size || ""] ?? 4;
      const pb = priorityMap[b.company_size || ""] ?? 4;
      if (pa !== pb) return pa - pb;
      // Both same priority — oldest ingestion first (nulls first already from query)
      const da = a.last_news_ingestion ? new Date(a.last_news_ingestion).getTime() : 0;
      const db = b.last_news_ingestion ? new Date(b.last_news_ingestion).getTime() : 0;
      return da - db;
    });

    const batch = sorted.slice(0, BATCH_SIZE);
    const results: Array<{ brand: string; status: string; events?: number }> = [];

    for (const brand of batch) {
      try {
        console.log(`[rotate] Processing: ${brand.name} (${brand.id})`);

        // Call unified-news-orchestrator for this brand
        const orchestratorUrl = `${supabaseUrl}/functions/v1/unified-news-orchestrator`;
        const res = await fetch(orchestratorUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ brand_id: brand.id, mode: "single" }),
        });

        const body = await res.json().catch(() => ({}));
        const eventsInserted = body?.inserted ?? body?.events_inserted ?? 0;

        // Update last_news_ingestion regardless of result
        await supabase
          .from("brands")
          .update({ last_news_ingestion: new Date().toISOString() })
          .eq("id", brand.id);

        results.push({ brand: brand.name, status: res.ok ? "ok" : `http_${res.status}`, events: eventsInserted });
        console.log(`[rotate] ${brand.name}: ${res.ok ? "ok" : res.status}, ${eventsInserted} events`);
      } catch (err) {
        console.error(`[rotate] Error for ${brand.name}:`, err);
        results.push({ brand: brand.name, status: "error" });

        // Still update timestamp so we don't retry the same brand immediately
        await supabase
          .from("brands")
          .update({ last_news_ingestion: new Date().toISOString() })
          .eq("id", brand.id);
      }
    }

    const summary = {
      success: true,
      batch_size: batch.length,
      ok: results.filter((r) => r.status === "ok").length,
      errors: results.filter((r) => r.status !== "ok").length,
      total_events: results.reduce((sum, r) => sum + (r.events ?? 0), 0),
      brands: results,
    };

    console.log(`[rotate] Complete: ${summary.ok}/${summary.batch_size} ok, ${summary.total_events} events`);

    return new Response(JSON.stringify(summary), { headers });
  } catch (error) {
    console.error("[rotate] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers }
    );
  }
});
