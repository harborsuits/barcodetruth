import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CATEGORY_KEYWORDS, NEGATIVE_GUARDS } from "../_shared/keywords.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Constants
const BATCH_SIZE = 100;
const LOOKBACK_DAYS = 90;

// Scoring helpers
const PHRASE_SCORE = 5;
const WORD_SCORE = 2;

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

function tokenScore(text: string): Record<string, number> {
  const scores: Record<string, number> = {};
  const t = ` ${norm(text)} `;

  for (const n of NEGATIVE_GUARDS) {
    if (t.includes(` ${norm(n)} `)) {
      scores["labor"] = -10;
    }
  }

  for (const [cat, dict] of Object.entries(CATEGORY_KEYWORDS)) {
    let s = 0;
    for (const p of dict.phrases) if (t.includes(` ${norm(p)} `)) s += PHRASE_SCORE;
    for (const w of dict.words) {
      const wb = String.raw`(?:\b|_|-)`;
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`${wb}${escaped}${wb}`, "gi");
      s += ((t.match(re) || []).length) * WORD_SCORE;
    }
    scores[cat] = (scores[cat] || 0) + s;
  }
  return scores;
}

function rank(scores: Record<string, number>) {
  const arr = Object.entries(scores)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const primary = arr[0]?.[0] ?? "noise";
  const primaryScore = arr[0]?.[1] ?? 0;
  const maxScore = Math.max(primaryScore, 10);
  const confidence = Math.max(0.35, Math.min(0.98, primaryScore / (maxScore + 4)));
  const secondary = arr.slice(1).filter(([, v]) => v >= 4).map(([k]) => k);
  return { primary, secondary, confidence };
}

const categoryCodeMap: Record<string, string> = {
  product_safety: "PRODUCT.RECALL",
  labor: "LABOR.SAFETY",
  environment: "ESG.ENVIRONMENT",
  policy: "POLICY.POLITICAL",
  legal: "LEGAL.LAWSUIT",
  financial: "FIN.EARNINGS",
  social: "SOCIAL.CAMPAIGN",
  privacy_ai: "REGULATORY.COMPLIANCE",
  human_rights_supply: "LABOR.DISCRIMINATION",
  antitrust_tax: "LEGAL.INVESTIGATION",
  noise: "NOISE.GENERAL"
};

const simpleCategoryMap: Record<string, string> = {
  "PRODUCT.RECALL": "social",
  "LABOR.SAFETY": "labor",
  "LABOR.DISCRIMINATION": "labor",
  "ESG.ENVIRONMENT": "environment",
  "POLICY.POLITICAL": "politics",
  "LEGAL.LAWSUIT": "social",
  "LEGAL.INVESTIGATION": "social",
  "FIN.EARNINGS": "social",
  "SOCIAL.CAMPAIGN": "social",
  "REGULATORY.COMPLIANCE": "environment",
  "NOISE.GENERAL": "social"
};

interface EventRow {
  event_id: string;
  brand_id: string;
  title: string | null;
  description: string | null;
  article_text: string | null;
  source_url: string | null;
}

function classifyEvent(event: EventRow) {
  const text = [event.title, event.description, event.article_text].filter(Boolean).join(" • ");
  const domain = (event.source_url || "").toLowerCase();
  
  const scores = tokenScore(text);
  let { primary, secondary, confidence } = rank(scores);

  // Domain hints
  if (["fda.gov","foodsafety.gov","cpsc.gov"].some(d => domain.includes(d))) {
    primary = "product_safety";
    confidence = Math.max(confidence, 0.85);
  }
  if (["nlrb.gov","osha.gov","dol.gov"].some(d => domain.includes(d))) {
    primary = "labor";
    confidence = Math.max(confidence, 0.85);
  }
  if (["epa.gov"].some(d => domain.includes(d))) {
    primary = "environment";
    confidence = Math.max(confidence, 0.85);
  }

  const financeNoiseDomains = ["fool.com","seekingalpha.com","benzinga.com","marketwatch.com"];
  const isFinanceNoise = financeNoiseDomains.some(d => domain.includes(d));
  const hasStockTipPhrases = /reasons to buy|stock to watch|price target|upgrade|downgrade|analyst rating/i.test(text);
  
  if ((isFinanceNoise || hasStockTipPhrases) && primary === "financial") {
    primary = "noise";
  }

  const finalCategoryCode = categoryCodeMap[primary] || "NOISE.GENERAL";
  const simpleCategory = simpleCategoryMap[finalCategoryCode] || "social";

  // Orientation detection
  const positiveSignals = ["award", "certification", "honored", "recognized", "praised", "improved", "success", "breakthrough"];
  const negativeSignals = ["lawsuit", "violation", "penalty", "fine", "recall", "scandal", "accused", "alleged", "investigation", "charged", "contamination"];
  
  const textLower = text.toLowerCase();
  const hasPositive = positiveSignals.some(sig => textLower.includes(sig));
  const hasNegative = negativeSignals.some(sig => textLower.includes(sig));

  // Severity detection - DB constraint requires 'minor'/'moderate'/'severe'
  const severitySignals = {
    severe: ["death", "explosion", "fatal", "criminal charges", "indictment", "recall", "contamination"],
    moderate: ["lawsuit", "fine", "penalty", "violation", "investigation", "complaint", "dispute", "backlash"],
    minor: ["settlement", "resolved", "minor"]
  };
  
  let severity: 'minor' | 'moderate' | 'severe' = 'moderate';
  if (severitySignals.severe.some(s => textLower.includes(s))) severity = 'severe';
  else if (severitySignals.minor.some(s => textLower.includes(s))) severity = 'minor';
  
  const severityMap: Record<string, number> = { minor: 0.3, moderate: 0.5, severe: 1.0 };
  const severityNumeric = severityMap[severity];

  let orientation: 'positive' | 'negative' | 'mixed' = 'mixed';
  let impactMagnitude = 0;
  
  if (primary === "noise") {
    orientation = 'mixed';
    impactMagnitude = 0;
  } else if (hasNegative && !hasPositive) {
    orientation = 'negative';
    impactMagnitude = -0.5 * severityNumeric;
  } else if (hasPositive && !hasNegative) {
    orientation = 'positive';
    impactMagnitude = 0.3 * severityNumeric;
  } else {
    impactMagnitude = -0.1 * severityNumeric;
  }

  const categoryImpacts: Record<string, number> = {
    labor: simpleCategory === "labor" ? impactMagnitude : 0,
    environment: simpleCategory === "environment" ? impactMagnitude : 0,
    politics: simpleCategory === "politics" ? impactMagnitude : 0,
    social: simpleCategory === "social" ? impactMagnitude : 0,
  };

  // Secondary impacts
  for (const sec of secondary) {
    const secSimple = simpleCategoryMap[categoryCodeMap[sec] || ""] || null;
    if (secSimple && secSimple !== simpleCategory && categoryImpacts[secSimple] !== undefined) {
      categoryImpacts[secSimple] = impactMagnitude * 0.3;
    }
  }

  // Credibility
  const highCredDomains = ["reuters.com", "apnews.com", "bbc.com", "npr.org", "nytimes.com"];
  const officialDomains = [".gov"];
  let credibility = 0.6;
  if (officialDomains.some(d => domain.includes(d))) credibility = 1.0;
  else if (highCredDomains.some(d => domain.includes(d))) credibility = 0.9;

  return {
    category: simpleCategory,
    category_code: finalCategoryCode,
    category_confidence: confidence,
    secondary_categories: secondary,
    orientation,
    is_irrelevant: primary === "noise",
    noise_reason: primary === "noise" ? "Stock tips/market chatter" : null,
    severity,
    credibility,
    verification_factor: 0.5,
    category_impacts: categoryImpacts,
    impact_labor: Math.round((categoryImpacts.labor || 0) * 10),
    impact_environment: Math.round((categoryImpacts.environment || 0) * 10),
    impact_politics: Math.round((categoryImpacts.politics || 0) * 10),
    impact_social: Math.round((categoryImpacts.social || 0) * 10),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { batchSize = BATCH_SIZE, dryRun = false } = await req.json().catch(() => ({}));

    console.log(`[backfill-event-impacts] Starting backfill (batch=${batchSize}, dryRun=${dryRun})`);

    // Find events with empty category_impacts in the last 90 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LOOKBACK_DAYS);

    const { data: events, error: fetchError } = await supabase
      .from("brand_events")
      .select("event_id, brand_id, title, description, article_text, source_url")
      .gte("created_at", cutoffDate.toISOString())
      .or("category_impacts.is.null,category_impacts.eq.{}")
      .limit(batchSize);

    if (fetchError) {
      console.error("[backfill-event-impacts] Fetch error:", fetchError);
      throw fetchError;
    }

    console.log(`[backfill-event-impacts] Found ${events?.length || 0} events to process`);

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        updated: 0,
        failed: 0,
        message: "No events need backfilling"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let updated = 0;
    let failed = 0;
    const stats = { noise: 0, labor: 0, environment: 0, politics: 0, social: 0 };

    for (const event of events) {
      try {
        const classification = classifyEvent(event as EventRow);
        stats[classification.category as keyof typeof stats]++;

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("brand_events")
            .update(classification)
            .eq("event_id", event.event_id);

          if (updateError) {
            console.error(`[backfill] Failed to update ${event.event_id}:`, updateError);
            failed++;
          } else {
            updated++;
          }
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`[backfill] Error processing ${event.event_id}:`, err);
        failed++;
      }
    }

    console.log(`[backfill-event-impacts] Complete: updated=${updated}, failed=${failed}, stats=${JSON.stringify(stats)}`);

    return new Response(JSON.stringify({
      success: true,
      processed: events.length,
      updated,
      failed,
      dryRun,
      categoryStats: stats
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[backfill-event-impacts] Error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
