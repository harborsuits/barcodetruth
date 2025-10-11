// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type BrandEffective = {
  brand_id: string;
  brand_name?: string | null;
  baseline_score: number | null;
  confidence: number | null;
  events_365d?: number | null;
};

type NamedRow = {
  brand_name: string;
  baseline_score: number | null;
  events_90d: number | null;
  events_365d: number | null;
  verified_rate: number | null;
  independent_sources: number | null;
  confidence: number | null;
  overall_effective: number | null;
  last_event_at: string | null;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Optional query params for thresholds
    const HIGH_SCORE = Number(url.searchParams.get("highScore") ?? 70);
    const LOW_CONF = Number(url.searchParams.get("lowConf") ?? 0.2);
    const HIGH_CONF = Number(url.searchParams.get("highConf") ?? 0.7);

    // Required env
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        500
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { "x-coverage-health": "1" } },
    });

    console.log("[validate-coverage-health] Starting validation checks…");

    // --- 1) Major brands sanity check (names must match your view)
    const majorNames = [
      "The Coca-Cola Company",
      "PepsiCo",
      "Mondelez International",
      "Unilever",
      "Nestlé",
    ];

    const { data: majorBrands, error: majorError } = await supabase
      .from("brand_score_effective_named")
      .select(
        `
        brand_name,
        baseline_score,
        events_90d,
        events_365d,
        verified_rate,
        independent_sources,
        confidence,
        overall_effective,
        last_event_at
      `
      )
      .in("brand_name", majorNames)
      .order("brand_name", { ascending: true }) as {
      data: NamedRow[] | null;
      error: any;
    };

    if (majorError) throw majorError;

    // --- 2) Pull ALL rows from brand_score_effective (paginated) for global stats
    const PAGE = 1000;
    let from = 0;
    let allScores: BrandEffective[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("brand_score_effective")
        .select(
          `
          brand_id,
          brand_name,
          baseline_score,
          confidence,
          events_365d
        `
        )
        .range(from, from + PAGE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allScores = allScores.concat(data as BrandEffective[]);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // --- 3) Confidence distribution (client-side width_bucket 0..1 into 10 bins)
    const buckets: Record<number, number> = {};
    for (const s of allScores) {
      const c = clamp(Number(s.confidence ?? 0), 0, 1);
      const bucket = Math.min(Math.floor(c * 10), 9); // 0..9
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    }
    const confidence_distribution = Array.from({ length: 10 }, (_, i) => ({
      bucket: i,
      confidence_range: Number((i * 0.1).toFixed(1)), // 0.0, 0.1, …, 0.9
      brand_count: buckets[i] || 0,
    }));

    // --- 4) Low-confidence high-score anomalies (server-side filter for speed)
    const { data: anomalies, error: anomError } = await supabase
      .from("brand_score_effective")
      .select("brand_id, brand_name, baseline_score, confidence, events_365d")
      .gte("baseline_score", HIGH_SCORE)
      .lt("confidence", LOW_CONF)
      .order("baseline_score", { ascending: false })
      .limit(50);

    if (anomError) throw anomError;

    // --- 5) Coverage refresh status (recent events)
    const { data: recentEvents, error: refreshError } = await supabase
      .from("brand_score_effective_named")
      .select("brand_name, last_event_at")
      .not("last_event_at", "is", null)
      .order("last_event_at", { ascending: false })
      .limit(5);

    if (refreshError) throw refreshError;

    // --- 6) Overall stats (client-side)
    const total_brands = allScores.length;
    const brands_with_data = allScores.filter((s) => (s.confidence ?? 0) > 0)
      .length;
    const high_confidence_brands = allScores.filter(
      (s) => (s.confidence ?? 0) >= HIGH_CONF
    ).length;
    const low_confidence_brands = allScores.filter(
      (s) => (s.confidence ?? 0) > 0 && (s.confidence ?? 0) < 0.35
    ).length;
    const avg_confidence =
      total_brands === 0
        ? 0
        : round3(
            allScores.reduce((acc, s) => acc + (s.confidence ?? 0), 0) /
              total_brands,
          );

    const zero_event_brands = allScores.filter(
      (s) => (s.events_365d ?? 0) === 0,
    ).length;

    // Detect out-of-range scores (regression guard)
    const over100 = allScores.filter((s) => (s.baseline_score ?? 0) > 100).length;
    const under0 = allScores.filter((s) => (s.baseline_score ?? 0) < 0).length;

    // --- 7) Warnings + status
    const warnings: string[] = [];

    // Range violation guard
    if (over100 > 0 || under0 > 0) {
      warnings.push(
        `⚠️ Baseline score out-of-range: >100 (${over100}), <0 (${under0}) — view logic regression!`,
      );
    }

    // Evidence quality checks
    const { count: genericCount } = await supabase
      .from('event_sources')
      .select('*', { head: true, count: 'exact' })
      .eq('is_generic', true);

    if ((genericCount ?? 0) > 100) {
      warnings.push(
        `${genericCount} source links point to generic/homepage URLs (awaiting specific permalinks)`,
      );
    }

    const { data: missingEvidence } = await supabase
      .from('brand_events')
      .select('event_id', { count: 'exact' })
      .is('verification', null)
      .limit(1);

    if ((missingEvidence?.length ?? 0) > 0) {
      warnings.push(
        `Some events lack verified evidence links (pending ingestion or archival)`,
      );
    }

    // Check for resolved sources without archives
    const { count: unresolvedArchives } = await supabase
      .from('event_sources')
      .select('*', { count: 'exact', head: true })
      .not('canonical_url', 'is', null)
      .eq('is_generic', false)
      .is('archive_url', null);

    if ((unresolvedArchives ?? 0) > 200) {
      warnings.push(
        `${unresolvedArchives} resolved sources lack archive URLs (archival backlog)`,
      );
    }

    // Check for resolved sources still marked generic (should be 0)
    const { count: resolvedButGeneric } = await supabase
      .from('event_sources')
      .select('*', { count: 'exact', head: true })
      .not('canonical_url', 'is', null)
      .eq('is_generic', true);

    if ((resolvedButGeneric ?? 0) > 0) {
      warnings.push(
        `⚠️ ${resolvedButGeneric} resolved sources incorrectly marked as generic (resolver bug - needs investigation)`,
      );
    }

    // Check last resolver run
    const { data: lastRun } = await supabase
      .from('evidence_resolution_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRun) {
      const age = Date.now() - new Date(lastRun.started_at).getTime();
      const ageHours = Math.round(age / (1000 * 60 * 60));
      const successRate = lastRun.processed > 0 
        ? Math.round((lastRun.resolved / lastRun.processed) * 100) 
        : 0;
      
      if (ageHours > 2) {
        warnings.push(
          `Resolver hasn't run in ${ageHours} hours (last run: ${lastRun.started_at})`,
        );
      }
      
      if (successRate < 20 && lastRun.processed > 10) {
        warnings.push(
          `Low resolver success rate: ${successRate}% (${lastRun.resolved}/${lastRun.processed} resolved)`,
        );
      }
    } else {
      warnings.push('Resolver has never run - evidence links pending resolution');
    }

    const majorsZero =
      (majorBrands ?? []).filter((b) => (b.events_365d ?? 0) === 0);
    if (majorsZero.length > 0) {
      warnings.push(
        `${majorsZero.length} major brands have zero events: ${majorsZero
          .map((b) => b.brand_name)
          .join(", ")}`,
      );
    }

    if ((anomalies ?? []).length > 5) {
      warnings.push(
        `${anomalies?.length} brands have high scores (≥${HIGH_SCORE}) but low confidence (<${LOW_CONF})`,
      );
    }

    if (avg_confidence < 0.25) {
      warnings.push(
        `Average confidence is low (${avg_confidence}). Check ingestion freshness or weighting.`,
      );
    }

    // Fetch top offenders if any exist
    let offenders: any[] = [];
    if (over100 > 0 || under0 > 0) {
      const { data } = await supabase
        .from("brand_score_effective")
        .select("brand_id, brand_name, baseline_score, overall_effective")
        .or("baseline_score.gt.100,baseline_score.lt.0,overall_effective.gt.100,overall_effective.lt.0")
        .limit(20);
      offenders = data ?? [];
    }

    const status = warnings.length === 0 ? "healthy" : "warnings";

    const report = {
      timestamp: new Date().toISOString(),
      params: { HIGH_SCORE, LOW_CONF, HIGH_CONF },
      major_brands: majorBrands ?? [],
      confidence_distribution,
      anomalies: anomalies ?? [],
      recent_events: recentEvents ?? [],
      overall_stats: {
        total_brands,
        brands_with_data,
        high_confidence_brands,
        low_confidence_brands,
        avg_confidence,
        zero_event_brands,
        out_of_range: { over100, under0 },
      },
      offenders: offenders.length > 0 ? offenders : undefined,
      summary: {
        total_checks: 11, // added resolver run tracking
        status,
        warnings,
      },
    };

    console.log("[validate-coverage-health] Done:", report.summary);

    // Optional webhook notification (Slack/Telegram/Discord)
    const WEBHOOK_URL = Deno.env.get("HEALTH_WEBHOOK_URL");
    if (WEBHOOK_URL) {
      const text = [
        `Coverage Health: *${status.toUpperCase()}*`,
        `Avg confidence: ${avg_confidence}`,
        `Brands: ${total_brands}, With data: ${brands_with_data}`,
        `High-conf: ${high_confidence_brands}, Low-conf: ${low_confidence_brands}`,
        warnings.length ? `Warnings:\n• ${warnings.join("\n• ")}` : "No warnings",
        `Run: ${new Date().toISOString()}`
      ].join("\n");

      // Fire-and-forget; don't block the response
      fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch(() => {});
    }

    return json(report, 200);
  } catch (e: any) {
    console.error("[validate-coverage-health] error:", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
    },
  });
}
