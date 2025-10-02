import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

type Cat = "labor" | "environment" | "politics" | "social";
type Severity = "minor" | "moderate" | "severe";
type Orientation = "negative" | "positive";

// Recency decay by age in months
const DECAY = (months: number): number =>
  months <= 3 ? 1.0 : months <= 6 ? 0.5 : months <= 12 ? 0.2 : 0;

// Source credibility weighting
const SRC_WEIGHT = (sourceName: string, verification: string | null): number => {
  const name = (sourceName || "").toLowerCase();
  // Government sources = highest credibility
  if (["epa", "osha", "fec"].some(g => name.includes(g))) return 1.0;
  // Major reputable news
  if (["new york times","nyt","guardian","reuters","associated press","ap","bbc","npr"].some(m => name.includes(m)))
    return 0.8;
  // Unverified = lowest
  if (verification === "unverified") return 0.5;
  // Other sources
  return 0.6;
};

// Event delta by severity and orientation
const DELTA_FOR = (level: Severity, orientation: Orientation): number => {
  const base = level === "severe" ? 15 : level === "moderate" ? 8 : 3;
  // Positive events count for half weight
  const signed = orientation === "negative" ? -base : +base * 0.5;
  return signed;
};

// Calculate months between two dates
const MONTHS_BETWEEN = (a: Date, b: Date): number => {
  const diff = (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
  return Math.max(0, diff);
};

// Inline severity computation (mirrors src/lib/severityConfig.ts logic)
function computeSeverity(input: {
  category: Cat;
  source?: string;
  impact_labor?: number | null;
  impact_environment?: number | null;
  impact_politics?: number | null;
  impact_social?: number | null;
  raw?: Record<string, any> | null;
}): { level: Severity; reason: string } {
  const source = (input.source || "").toUpperCase();

  // EPA (Environment)
  if (source === "EPA" || input.category === "environment") {
    const qnc = Number(input.raw?.Qtrs_with_NC ?? input.raw?.qnc ?? 0);
    const impact = Number(input.impact_environment ?? 0);
    
    if (qnc >= 4) return { level: "severe", reason: "4+ quarters non-compliance" };
    if (qnc >= 2) return { level: "moderate", reason: "2–3 quarters non-compliance" };
    if (qnc >= 1) return { level: "minor", reason: "1 quarter non-compliance" };
    
    if (impact <= -5) return { level: "severe", reason: "Multiple violations" };
    if (impact <= -3) return { level: "moderate", reason: "Notable violation(s)" };
    if (impact < 0) return { level: "minor", reason: "Incident reported" };
    return { level: "minor", reason: "Informational" };
  }

  // OSHA (Labor)
  if (source === "OSHA" || input.category === "labor") {
    const serious = Number(input.raw?.nr_serious ?? 0);
    const willful = Number(input.raw?.nr_willful ?? 0);
    const repeat = Number(input.raw?.nr_repeat ?? 0);
    const penalty = Number(input.raw?.total_current_penalty ?? 0);
    const impact = Number(input.impact_labor ?? 0);

    if (willful >= 2 || penalty >= 100_000) return { level: "severe", reason: "High penalties / willful" };
    if (repeat >= 1 || serious >= 3 || penalty >= 25_000) return { level: "moderate", reason: "Serious or repeat" };
    if (serious >= 1) return { level: "minor", reason: "Serious violation" };

    if (impact <= -5) return { level: "severe", reason: "Severe impact" };
    if (impact <= -3) return { level: "moderate", reason: "Moderate impact" };
    if (impact < 0) return { level: "minor", reason: "Minor impact" };
    return { level: "minor", reason: "Informational" };
  }

  // FEC (Politics)
  if (source === "FEC" || input.category === "politics") {
    const tiltPct = Number(input.raw?.tilt_pct ?? 0);
    const impact = Number(input.impact_politics ?? 0);

    if (tiltPct >= 85) return { level: "severe", reason: `${tiltPct}% partisan tilt` };
    if (tiltPct >= 70) return { level: "moderate", reason: `${tiltPct}% partisan tilt` };
    if (tiltPct >= 55) return { level: "minor", reason: `${tiltPct}% partisan tilt` };

    if (impact <= -5) return { level: "severe", reason: "Severe impact" };
    if (impact <= -3) return { level: "moderate", reason: "Moderate impact" };
    if (impact < 0) return { level: "minor", reason: "Minor impact" };
    return { level: "minor", reason: "Informational" };
  }

  // News/Social
  if (source === "THE GUARDIAN" || source === "NEWSAPI" || input.category === "social") {
    const title = String(input.raw?.title || input.raw?.headline || "").toLowerCase();
    const summary = String(input.raw?.summary || input.raw?.description || "").toLowerCase();
    const text = `${title} ${summary}`;
    const impact = Number(input.impact_social ?? 0);

    if (/(class.action|criminal|felony|indictment|sentenced)/i.test(text)) {
      return { level: "severe", reason: "Legal action" };
    }
    if (/(lawsuit|recall|boycott)/i.test(text)) {
      return { level: "moderate", reason: "Significant issue" };
    }
    if (/(scandal|controversy|protest|discrimination)/i.test(text)) {
      return { level: "minor", reason: "Controversy reported" };
    }

    if (impact <= -5) return { level: "severe", reason: "Severe impact" };
    if (impact <= -3) return { level: "moderate", reason: "Moderate impact" };
    if (impact < 0) return { level: "minor", reason: "Minor impact" };
    return { level: "minor", reason: "Informational" };
  }

  // Generic fallback
  const byCatImpact =
    input.category === "environment" ? Number(input.impact_environment ?? 0) :
    input.category === "labor" ? Number(input.impact_labor ?? 0) :
    input.category === "politics" ? Number(input.impact_politics ?? 0) :
    Number(input.impact_social ?? 0);

  if (byCatImpact <= -5) return { level: "severe", reason: "Severe impact" };
  if (byCatImpact <= -3) return { level: "moderate", reason: "Moderate impact" };
  if (byCatImpact < 0) return { level: "minor", reason: "Minor impact" };
  return { level: "minor", reason: "Informational" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const brandId = url.searchParams.get("brand_id");
    const windowMonths = Number(url.searchParams.get("window_months") ?? "12");
    const dryrun = url.searchParams.get("dryrun") === "1";

    if (!brandId) {
      return new Response(
        JSON.stringify({ error: "brand_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const windowEnd = new Date();
    const windowStart = new Date();
    windowStart.setMonth(windowEnd.getMonth() - windowMonths);

    console.log(`[calculate-brand-score] Calculating for brand ${brandId}, window ${windowMonths}mo, dryrun=${dryrun}`);

    // Fetch brand events + sources
    const { data: events, error: evErr } = await supabase
      .from("brand_events")
      .select(`
        event_id,
        category,
        event_date,
        orientation,
        verification,
        impact_labor,
        impact_environment,
        impact_politics,
        impact_social,
        raw_data,
        event_sources(source_name, source_url, source_date)
      `)
      .eq("brand_id", brandId)
      .gte("event_date", windowStart.toISOString())
      .lte("event_date", windowEnd.toISOString())
      .order("event_date", { ascending: false });

    if (evErr) throw evErr;

    // Initialize per-category scores with base 50
    const cats: Cat[] = ["labor", "environment", "politics", "social"];
    const totals: Record<Cat, number> = {
      labor: 50,
      environment: 50,
      politics: 50,
      social: 50
    };
    const used: Record<Cat, any[]> = {
      labor: [],
      environment: [],
      politics: [],
      social: []
    };

    const now = new Date();

    // Process each event
    for (const ev of (events || [])) {
      const category = (ev.category || "social") as Cat;
      
      // Get primary source for credibility
      const sources = Array.isArray(ev.event_sources) ? ev.event_sources : [];
      const srcName = sources[0]?.source_name ?? "";
      const credibility = SRC_WEIGHT(srcName, ev.verification);

      // Compute severity using centralized logic
      const sev = computeSeverity({
        category,
        source: srcName,
        impact_labor: ev.impact_labor,
        impact_environment: ev.impact_environment,
        impact_politics: ev.impact_politics,
        impact_social: ev.impact_social,
        raw: ev.raw_data ?? null,
      });

      const level = sev.level;
      const orientation = (ev.orientation ?? "negative") as Orientation;

      // Calculate recency decay
      const ageMonths = MONTHS_BETWEEN(now, new Date(ev.event_date));
      const decay = DECAY(ageMonths);
      if (decay === 0) continue; // Ignore events >12 months

      // Calculate effective delta
      let delta = DELTA_FOR(level, orientation) * decay * credibility;

      // Cap single event impact at ±30
      if (delta > 30) delta = 30;
      if (delta < -30) delta = -30;

      totals[category] += delta;

      used[category].push({
        event_id: ev.event_id,
        date: ev.event_date,
        source: srcName,
        credibility: Math.round(credibility * 100) / 100,
        severity: level,
        orientation,
        decay: Math.round(decay * 100) / 100,
        effective_delta: Math.round(delta * 10) / 10,
      });
    }

    // Clamp all scores to [0, 100]
    for (const c of cats) {
      totals[c] = Math.max(0, Math.min(100, Math.round(totals[c])));
    }

    // Build breakdown for UI transparency
    const breakdown = {
      window: {
        start: windowStart.toISOString(),
        end: windowEnd.toISOString()
      },
      base: 50,
      per_category: {
        labor: { score: totals.labor, events: used.labor },
        environment: { score: totals.environment, events: used.environment },
        politics: { score: totals.politics, events: used.politics },
        social: { score: totals.social, events: used.social },
      }
    };

    if (!dryrun) {
      // Persist to brand_scores
      const { error: upErr } = await supabase
        .from("brand_scores")
        .upsert(
          {
            brand_id: brandId,
            score_labor: totals.labor,
            score_environment: totals.environment,
            score_politics: totals.politics,
            score_social: totals.social,
            window_start: windowStart.toISOString(),
            window_end: windowEnd.toISOString(),
            breakdown,
            last_updated: new Date().toISOString(),
          },
          { onConflict: "brand_id" }
        );

      if (upErr) throw upErr;
      console.log(`[calculate-brand-score] Updated scores for brand ${brandId}`);
    } else {
      console.log(`[calculate-brand-score] Dryrun - not persisting`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryrun,
        scores: totals,
        breakdown,
        counts: {
          labor: used.labor.length,
          environment: used.environment.length,
          politics: used.politics.length,
          social: used.social.length,
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (e: any) {
    console.error("[calculate-brand-score] error:", e);
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
