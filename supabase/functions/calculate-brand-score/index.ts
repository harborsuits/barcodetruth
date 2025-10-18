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

// FEC party tilt calculation
type PartySum = { dem: number; rep: number; other: number };

function sumFecParty(raw: any, acc: PartySum): PartySum {
  const party = (raw?.recipient_party || raw?.party || raw?.recipient?.party || '').toUpperCase();
  const amt = Math.abs(Number(raw?.amount ?? raw?.total ?? 0)) || 0;
  if (!amt) return acc;
  if (party?.startsWith('DEM')) acc.dem += amt;
  else if (party?.startsWith('REP')) acc.rep += amt;
  else acc.other += amt;
  return acc;
}

function politicsBaselineFromFEC(histEvents: any[]): { value: number; reason: string } {
  const fecRows = histEvents.filter(e => e.category === 'politics' && e.raw_data);
  if (fecRows.length < 3) return { value: 50, reason: 'Insufficient FEC history' };

  const sums = fecRows.reduce((acc, e) => sumFecParty(e.raw_data, acc), { dem: 0, rep: 0, other: 0 } as PartySum);
  const totalMajor = sums.dem + sums.rep;
  if (totalMajor <= 0) return { value: 50, reason: 'Balanced or non-major recipients' };

  const repShare = sums.rep / totalMajor;
  if (repShare >= 0.80) return { value: 35, reason: `${Math.round(repShare*100)}% Republican tilt (FEC receipts)` };
  if (repShare <= 0.20) return { value: 65, reason: `${Math.round((1-repShare)*100)}% Democratic tilt (FEC receipts)` };
  return { value: 50, reason: 'Mixed FEC donations (±20%)' };
}

// Provenance extraction
function envProvenanceReason(envEvents: any[]): string | null {
  const ids = envEvents
    .map(e => e.raw_data?.echo_case_id || e.raw_data?.case_id || e.raw_data?.facility_id || e.raw_data?.echo_facility_id)
    .filter(Boolean)
    .slice(0, 5);
  if (ids.length === 0) return null;
  return `EPA/ECHO refs: ${ids.join(', ')}`;
}

function laborProvenanceReason(labEvents: any[]): string | null {
  const ids = labEvents
    .map(e => e.raw_data?.osha_activity_id || e.raw_data?.inspection || e.raw_data?.enforcement_id)
    .filter(Boolean)
    .slice(0, 5);
  if (ids.length === 0) return null;
  return `OSHA refs: ${ids.join(', ')}`;
}

// Stable blend to avoid whiplash
function blendStable(opts: {
  base: number;
  windowDelta: number;
  evidenceCount: number;
  verifiedCount: number;
  windowDays: number;
  per30DayCap?: number;
}): number {
  const { base, windowDelta, evidenceCount, verifiedCount, windowDays, per30DayCap = 10 } = opts;
  const λ = Math.max(0.05, Math.min(0.6, 0.10 + 0.02*evidenceCount + 0.05*verifiedCount - 0.001*windowDays));
  const target = base + windowDelta;
  const blended = (1 - λ) * base + λ * target;
  const cap = Math.max(5, per30DayCap * Math.max(1, windowDays / 30));
  return Math.max(base - cap, Math.min(base + cap, blended));
}

// GDELT tone fetcher
async function fetchGdeltTone(brandName: string): Promise<{ medianTone: number; docCount: number }> {
  try {
    // Quote brand name and filter to English for better precision
    const q = `"${brandName}" sourcelang:english`;
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&timespan=24m&mode=ArtList&format=json&maxrecords=250`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.warn(`[GDELT] fetch failed: ${res.status}`);
      return { medianTone: 0, docCount: 0 };
    }
    const data = await res.json();
    if (!data.articles || !Array.isArray(data.articles)) {
      return { medianTone: 0, docCount: 0 };
    }
    const tones = data.articles
      .map((a: any) => Number(a.tone))
      .filter((t: number) => !isNaN(t) && isFinite(t));
    
    if (tones.length < 30) {
      return { medianTone: 0, docCount: tones.length }; // Insufficient data for baseline
    }
    
    // Winsorized median (trim extreme 5% outliers for robustness)
    const sorted = [...tones].sort((a: number, b: number) => a - b);
    const lo = Math.floor(0.05 * sorted.length);
    const hi = Math.ceil(0.95 * sorted.length) - 1;
    const clipped = sorted.slice(lo, hi + 1);
    const median = clipped[Math.floor(clipped.length / 2)] ?? 0;
    
    return { medianTone: median, docCount: tones.length };
  } catch (e) {
    console.error('[GDELT] error:', e);
    return { medianTone: 0, docCount: 0 };
  }
}

// Social baseline from GDELT tone
function socialBaselineFromGdelt(medianTone: number, docCount: number): { value: number; reason: string } {
  if (docCount < 30) return { value: 50, reason: 'Insufficient GDELT data (<30 docs)' };
  const clamped = Math.max(-10, Math.min(10, medianTone));
  const score = 50 + (clamped / 10) * 20; // linear map: -10→30, 0→50, +10→70
  return { 
    value: Math.round(score), 
    reason: `Median GDELT tone ${medianTone.toFixed(1)} across ${docCount} docs (24mo)` 
  };
}

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

  const t0 = performance.now();

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

    // Fetch brand name for GDELT
    const { data: brand, error: brandErr } = await supabase
      .from("brands")
      .select("name")
      .eq("id", brandId)
      .single();

    if (brandErr || !brand) {
      console.warn(`[calculate-brand-score] Could not fetch brand name: ${brandErr?.message}`);
    }

    const brandName = brand?.name ?? "Unknown";

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

    // Calculate historical baselines (24-month lookback for established pattern)
    const baselineStart = new Date();
    baselineStart.setMonth(baselineStart.getMonth() - 24);

    const { data: histEvents, error: histErr } = await supabase
      .from("brand_events")
      .select("category, orientation, verification, impact_labor, impact_environment, impact_politics, impact_social, raw_data, event_sources(source_name)")
      .eq("brand_id", brandId)
      .gte("event_date", baselineStart.toISOString())
      .lte("event_date", windowStart.toISOString()); // events *before* current window

    if (histErr) console.warn("[baseline] Could not fetch historical events:", histErr);

    // Per-category baseline logic - default to neutral 50
    const cats: Cat[] = ["labor","environment","politics","social"];
    const baselines: Record<Cat, { value: number; reason: string }> = {
      labor: { value: 50, reason: "Default baseline (insufficient historical data)" },
      environment: { value: 50, reason: "Default baseline (insufficient historical data)" },
      politics: { value: 50, reason: "Default baseline (insufficient historical data)" },
      social: { value: 50, reason: "Default baseline (insufficient historical data)" }
    };

    // Only adjust baselines if we have meaningful historical data
    if (histEvents && histEvents.length > 2) {
      // Politics: FEC party tilt (actual donor breakdown)
      baselines.politics = politicsBaselineFromFEC(histEvents);

      // Environment: EPA violation density + provenance
      const envEvents = histEvents.filter(e => e.category === "environment");
      if (envEvents.length >= 2) {
        const severeCount = envEvents.filter(e => {
          const qnc = Number(e.raw_data?.Qtrs_with_NC ?? e.raw_data?.qnc ?? 0);
          return qnc >= 4 || Number(e.impact_environment || 0) <= -5;
        }).length;
        const prov = envProvenanceReason(envEvents);
        if (severeCount >= 2) {
          baselines.environment = { value: 40, reason: `Chronic environmental offender (2+ severe in 24m). ${prov ?? ''}`.trim() };
        } else if (envEvents.length >= 4) {
          baselines.environment = { value: 45, reason: `Repeated environmental issues. ${prov ?? ''}`.trim() };
        }
      }

      // Labor: OSHA violation density + provenance
      const labEvents = histEvents.filter(e => e.category === "labor");
      if (labEvents.length >= 2) {
        const seriousCount = labEvents.filter(e => {
          const willful = Number(e.raw_data?.nr_willful ?? 0);
          const serious = Number(e.raw_data?.nr_serious ?? 0);
          return willful >= 1 || serious >= 3 || Number(e.impact_labor || 0) <= -5;
        }).length;
        const prov = laborProvenanceReason(labEvents);
        if (seriousCount >= 2) {
          baselines.labor = { value: 40, reason: `Chronic labor safety offender (2+ serious/willful in 24m). ${prov ?? ''}`.trim() };
        } else if (labEvents.length >= 4) {
          baselines.labor = { value: 45, reason: `Repeated labor issues. ${prov ?? ''}`.trim() };
        }
      }
    }
    
    // Social: GDELT tone baseline (optional - fail gracefully)
    let gdeltDocCount = 0;
    try {
      const gdeltData = await fetchGdeltTone(brandName);
      gdeltDocCount = gdeltData.docCount;
      const gdeltBaseline = socialBaselineFromGdelt(gdeltData.medianTone, gdeltData.docCount);
      // Only use GDELT if we have sufficient data
      if (gdeltData.docCount >= 30) {
        baselines.social = gdeltBaseline;
      }
      console.info('[gdelt]', { brand: brandName, medianTone: gdeltData.medianTone, docCount: gdeltData.docCount, mappedScore: gdeltBaseline.value });
    } catch (e) {
      console.warn('[gdelt] Failed to fetch GDELT data, using default baseline:', e);
    }

    // Initialize per-category scores from calculated baselines
    const totals: Record<Cat, number> = {
      labor: baselines.labor.value,
      environment: baselines.environment.value,
      politics: baselines.politics.value,
      social: baselines.social.value
    };
    const used: Record<Cat, any[]> = {
      labor: [],
      environment: [],
      politics: [],
      social: []
    };

    const now = new Date();
    const windowDays = Math.max(1, MONTHS_BETWEEN(now, windowStart) * 30.4375);

    // Track window deltas and evidence per category
    const deltas: Record<Cat, number> = { labor: 0, environment: 0, politics: 0, social: 0 };
    const evidenceCount: Record<Cat, number> = { labor: 0, environment: 0, politics: 0, social: 0 };
    const verifiedCount: Record<Cat, number> = { labor: 0, environment: 0, politics: 0, social: 0 };
    const mutedDeltas: Record<Cat, boolean> = { labor: false, environment: false, politics: false, social: false };

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

      deltas[category] += delta;
      evidenceCount[category]++;
      
      // Count verified sources (government or corroborated)
      if (ev.verification === 'official' || ev.verification === 'corroborated') {
        verifiedCount[category]++;
      }

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

    // Proof gate: mute large deltas (>|5|) without verified sources
    for (const c of cats) {
      const needsProof = Math.abs(deltas[c]) > 5 && verifiedCount[c] === 0;
      if (needsProof) {
        mutedDeltas[c] = true;
        deltas[c] = 0;
      }
    }

    // Apply stable blend with caps (anti-whiplash)
    for (const c of cats) {
      totals[c] = Math.round(
        blendStable({
          base: baselines[c].value,
          windowDelta: deltas[c],
          evidenceCount: evidenceCount[c],
          verifiedCount: verifiedCount[c],
          windowDays
        })
      );
      totals[c] = Math.max(0, Math.min(100, totals[c]));
    }

    // Calculate confidence per category
    const confidence: Record<Cat, number> = {} as Record<Cat, number>;
    for (const c of cats) {
      const conf = Math.min(100,
        40 + 8*verifiedCount[c] + 3*evidenceCount[c] - Math.max(0, 0.2*(30 - windowDays))
      );
      confidence[c] = Math.max(0, Math.round(conf));
    }

    // Telemetry for debugging
    const emptyBaseReasons = cats.filter(c => !baselines[c].reason || baselines[c].reason.trim() === '');
    const mutedCount = cats.filter(c => mutedDeltas[c]).length;
    
    console.info('[score]', {
      brandId,
      baselines: Object.fromEntries(cats.map(c => [c, baselines[c]])),
      deltas: Object.fromEntries(cats.map(c => [c, Math.round(deltas[c])])),
      mutedDeltas: Object.fromEntries(cats.map(c => [c, mutedDeltas[c]])),
      evidenceCount,
      verifiedCount,
      confidence,
      totalsAfterBlend: totals,
    });
    
    // Monitoring alerts
    if (emptyBaseReasons.length > 0) {
      console.warn('[monitoring] Empty base_reason for categories:', emptyBaseReasons);
    }
    if (mutedCount > 0) {
      console.warn('[monitoring] Muted deltas (proof gate) for', mutedCount, 'categories');
    }
    if (baselines.social.value !== 50 && gdeltDocCount < 30) {
      console.warn('[monitoring] Low GDELT coverage for high-traffic brand:', { brand: brandName, docCount: gdeltDocCount });
    }

    // Build breakdown for UI transparency
    const breakdown = {
      window: {
        start: windowStart.toISOString(),
        end: windowEnd.toISOString(),
        days: Math.round(windowDays)
      },
      baselines: {
        labor: baselines.labor,
        environment: baselines.environment,
        politics: baselines.politics,
        social: baselines.social,
      },
      per_category: {
        labor: { 
          score: totals.labor, 
          baseline: baselines.labor.value,
          baseline_reason: baselines.labor.reason,
          window_delta: Math.round(deltas.labor),
          evidence_count: evidenceCount.labor,
          verified_count: verifiedCount.labor,
          confidence: confidence.labor,
          proof_required: mutedDeltas.labor,
          events: used.labor 
        },
        environment: { 
          score: totals.environment, 
          baseline: baselines.environment.value,
          baseline_reason: baselines.environment.reason,
          window_delta: Math.round(deltas.environment),
          evidence_count: evidenceCount.environment,
          verified_count: verifiedCount.environment,
          confidence: confidence.environment,
          proof_required: mutedDeltas.environment,
          events: used.environment 
        },
        politics: { 
          score: totals.politics, 
          baseline: baselines.politics.value,
          baseline_reason: baselines.politics.reason,
          window_delta: Math.round(deltas.politics),
          evidence_count: evidenceCount.politics,
          verified_count: verifiedCount.politics,
          confidence: confidence.politics,
          proof_required: mutedDeltas.politics,
          events: used.politics 
        },
        social: { 
          score: totals.social, 
          baseline: baselines.social.value,
          baseline_reason: baselines.social.reason,
          window_delta: Math.round(deltas.social),
          evidence_count: evidenceCount.social,
          verified_count: verifiedCount.social,
          confidence: confidence.social,
          proof_required: mutedDeltas.social,
          events: used.social 
        },
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

    const dur = Math.round(performance.now() - t0);
    
    console.log(JSON.stringify({
      level: "info",
      fn: "calculate-brand-score",
      brandId,
      baselines: {
        labor: baselines.labor.value,
        environment: baselines.environment.value,
        politics: baselines.politics.value,
        social: baselines.social.value
      },
      deltas,
      verifiedCount: {
        labor: verifiedCount.labor,
        environment: verifiedCount.environment,
        politics: verifiedCount.politics,
        social: verifiedCount.social
      },
      evidenceCount: {
        labor: evidenceCount.labor,
        environment: evidenceCount.environment,
        politics: evidenceCount.politics,
        social: evidenceCount.social
      },
      mutedDeltas,
      totalsAfterBlend: totals,
      dryrun,
      dur_ms: dur,
      ok: true
    }));

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
    const dur = Math.round(performance.now() - t0);
    console.error(JSON.stringify({
      level: "error",
      fn: "calculate-brand-score",
      brandId: new URL(req.url).searchParams.get("brand_id") || "none",
      msg: String(e?.message || e),
      dur_ms: dur
    }));
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
