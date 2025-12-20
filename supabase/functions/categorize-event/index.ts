// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CATEGORY_KEYWORDS, NEGATIVE_GUARDS } from "../_shared/keywords.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHRASE_SCORE = 5;
const WORD_SCORE = 2;
const SECONDARY_MIN = 4;    // keep meaningful secondaries
const CONF_MAX = 0.98;
const CONF_MIN = 0.35;

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

function tokenScore(text: string) {
  const scores: Record<string, number> = {};
  const t = ` ${norm(text)} `;

  // global negatives
  for (const n of NEGATIVE_GUARDS) {
    if (t.includes(` ${norm(n)} `)) {
      // dampen labor/strike false positives strongly
      scores["labor"] = -10;
    }
  }

  for (const [cat, dict] of Object.entries(CATEGORY_KEYWORDS)) {
    let s = 0;
    for (const p of dict.phrases) if (t.includes(` ${norm(p)} `)) s += PHRASE_SCORE;
    for (const w of dict.words) {
      // Improved word boundary: handles hyphens and underscores
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
  const maxScore = Math.max(primaryScore, 10); // avoid div/0 and extreme 1.0
  const confidence = Math.max(CONF_MIN, Math.min(CONF_MAX, primaryScore / (maxScore + 4)));

  const secondary = arr.slice(1).filter(([, v]) => v >= SECONDARY_MIN).map(([k]) => k);
  return { primary, secondary, confidence };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // secure: edge functions
    );

    const { event_id, brand_id, title, summary, content, source_domain } = await req.json();

    const text = [title, summary, content, source_domain].filter(Boolean).join(" • ");
    const scores = tokenScore(text);
    let { primary, secondary, confidence } = rank(scores);

    // Domain-based hints (expanded)
    const domain = (source_domain || "").toLowerCase();
    
    // Safety sources
    if (["fda.gov","foodsafety.gov","cpsc.gov","ema.europa.eu"].some(d => domain.includes(d))) {
      primary = "product_safety";
      confidence = Math.max(confidence, 0.85);
    }
    
    // Labor sources
    if (["nlrb.gov","osha.gov","dol.gov"].some(d => domain.includes(d))) {
      primary = "labor";
      confidence = Math.max(confidence, 0.85);
    }
    
    // Environment sources
    if (["epa.gov","ec.europa.eu"].some(d => domain.includes(d)) || /environment\.gov/i.test(domain)) {
      primary = "environment";
      confidence = Math.max(confidence, 0.85);
    }

    // Finance noise sources - aggressively tag as noise
    const financeNoiseDomains = ["fool.com","seekingalpha.com","benzinga.com","marketwatch.com"];
    const isFinanceNoise = financeNoiseDomains.some(d => domain.includes(d));
    const hasStockTipPhrases = /reasons to buy|stock to watch|price target|upgrade|downgrade|analyst rating|buy rating|sell rating/i.test(text);
    
    if ((isFinanceNoise || hasStockTipPhrases) && primary === "financial") {
      primary = "noise";
    }

    // Map to existing category_code format if needed
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

    const finalCategoryCode = categoryCodeMap[primary] || "NOISE.GENERAL";

    // Extract simple category for the category enum column (used by scorer)
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
    const simpleCategory = simpleCategoryMap[finalCategoryCode] || "social";

    // Log to classification audit for telemetry
    await supabase
      .from("classification_audit")
      .upsert({
        event_id,
        brand_id,
        primary_code: finalCategoryCode,
        secondary_codes: secondary,
        confidence,
        source_domain,
        keyword_scores: scores
      }, { onConflict: 'event_id' })
      .then(({ error }) => {
        if (error) console.warn("[categorize-event] Audit log warning:", error);
      });

    // Detect orientation: positive, negative, or neutral
    const positiveSignals = ["award", "certification", "honored", "recognized", "praised", "improved", "success", "breakthrough", "innovation", "leadership", "chooses", "selects", "partners"];
    const negativeSignals = ["lawsuit", "violation", "penalty", "fine", "recall", "scandal", "accused", "alleged", "investigation", "charged", "contamination", "injury", "death", "fraud"];
    
    const textLower = text.toLowerCase();
    const hasPositive = positiveSignals.some(sig => textLower.includes(sig));
    const hasNegative = negativeSignals.some(sig => textLower.includes(sig));
    
    let orientation: 'positive' | 'negative' | 'mixed' = 'mixed';
    
    // Determine base impact magnitude based on severity signals
    // NOTE: DB constraint requires 'minor'/'moderate'/'severe'
    const severitySignals = {
      severe: ["death", "explosion", "fatal", "mass casualty", "criminal charges", "indictment", "recall", "contamination"],
      moderate: ["lawsuit", "fine", "penalty", "violation", "investigation", "complaint", "dispute", "backlash", "criticism", "alleged", "accused"],
      minor: ["settlement", "resolved", "clarification", "minor"]
    };
    
    let severity: 'minor' | 'moderate' | 'severe' = 'moderate';
    if (severitySignals.severe.some(s => textLower.includes(s))) severity = 'severe';
    else if (severitySignals.minor.some(s => textLower.includes(s))) severity = 'minor';
    
    // Map severity to numeric (0-1)
    const severityMap: Record<string, number> = { minor: 0.3, moderate: 0.5, severe: 1.0 };
    const severityNumeric = severityMap[severity];
    
    // Determine impact magnitude (in [-1, +1] range)
    let impactMagnitude = 0;
    if (primary === "noise") {
      orientation = 'mixed';
      impactMagnitude = 0;
    } else if (hasNegative && !hasPositive) {
      orientation = 'negative';
      impactMagnitude = -0.5 * severityNumeric; // Scale by severity, max -0.5 for single event
    } else if (hasPositive && !hasNegative) {
      orientation = 'positive';
      impactMagnitude = 0.3 * severityNumeric; // Positive news is less impactful
    } else {
      // Mixed or unclear
      impactMagnitude = -0.1 * severityNumeric; // Slight negative bias for uncertainty
    }
    
    // Build category_impacts JSONB (the canonical scoring field)
    const categoryImpacts: Record<string, number> = {
      labor: simpleCategory === "labor" ? impactMagnitude : 0,
      environment: simpleCategory === "environment" ? impactMagnitude : 0,
      politics: simpleCategory === "politics" ? impactMagnitude : 0,
      social: simpleCategory === "social" ? impactMagnitude : 0,
    };
    
    // Add secondary category impacts at reduced weight
    for (const sec of secondary) {
      const secSimple = simpleCategoryMap[categoryCodeMap[sec] || ""] || null;
      if (secSimple && secSimple !== simpleCategory && categoryImpacts[secSimple] !== undefined) {
        categoryImpacts[secSimple] = impactMagnitude * 0.3; // 30% weight for secondary
      }
    }
    
    // Determine credibility based on domain
    const highCredDomains = ["reuters.com", "apnews.com", "bbc.com", "npr.org", "nytimes.com", "washingtonpost.com"];
    const officialDomains = [".gov", "sec.gov", "epa.gov", "fda.gov", "osha.gov", "nlrb.gov"];
    let credibility = 0.6; // default
    if (officialDomains.some(d => domain.includes(d))) credibility = 1.0;
    else if (highCredDomains.some(d => domain.includes(d))) credibility = 0.9;
    
    // Determine verification_factor (default: unverified)
    // This should be updated by corroboration system later
    const verificationFactor = 0.5; // "other_coverage" default
    
    // Legacy impact columns (kept for compatibility)
    const impactScores = {
      impact_labor: Math.round((categoryImpacts.labor || 0) * 10),
      impact_environment: Math.round((categoryImpacts.environment || 0) * 10),
      impact_politics: Math.round((categoryImpacts.politics || 0) * 10),
      impact_social: Math.round((categoryImpacts.social || 0) * 10),
    };

    // persist to brand_events
    const { error: updateError } = await supabase
      .from("brand_events")
      .update({
        category: simpleCategory,
        category_code: finalCategoryCode,
        category_confidence: confidence,
        secondary_categories: secondary,
        orientation,
        is_irrelevant: primary === "noise",
        noise_reason: primary === "noise" ? "Stock tips/market chatter" : null,
        severity,
        credibility,
        verification_factor: verificationFactor,
        category_impacts: categoryImpacts, // ← THE KEY FIELD for scoring
        ...impactScores,
      })
      .eq("event_id", event_id)
      .eq("brand_id", brand_id);

    if (updateError) {
      console.error("[categorize-event] Update error:", updateError);
      throw updateError;
    }

    console.log(`[categorize-event] ${event_id}: ${finalCategoryCode} (confidence: ${confidence.toFixed(2)})`);

    return new Response(
      JSON.stringify({ 
        primary: finalCategoryCode, 
        secondary, 
        confidence,
        scores 
      }), 
      { 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error: any) {
    console.error("[categorize-event] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500, 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
});
