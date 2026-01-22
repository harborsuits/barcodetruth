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
const SECONDARY_MIN = 4;
const CONF_MAX = 0.98;
const CONF_MIN = 0.35;

// FIXED: Impact magnitudes now use whole numbers that don't round to zero
// Scale: minor=-2/-3, moderate=-4/-6, severe=-8/-12, critical=-10/-15
const SEVERITY_IMPACTS = {
  minor: { negative: -2, positive: 1 },
  moderate: { negative: -5, positive: 2 },
  severe: { negative: -10, positive: 3 },
  critical: { negative: -15, positive: 4 },
};

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

function tokenScore(text: string) {
  const scores: Record<string, number> = {};
  const t = ` ${norm(text)} `;

  // global negatives
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
  const primary = arr[0]?.[0] ?? "social"; // FIXED: Default to social instead of noise
  const primaryScore = arr[0]?.[1] ?? 0;
  const maxScore = Math.max(primaryScore, 10);
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { event_id, brand_id, title, summary, content, source_domain } = await req.json();

    const text = [title, summary, content, source_domain].filter(Boolean).join(" • ");
    const scores = tokenScore(text);
    let { primary, secondary, confidence } = rank(scores);

    const domain = (source_domain || "").toLowerCase();
    
    // Domain-based hints (expanded) - override to proper category
    if (["fda.gov","foodsafety.gov","cpsc.gov","ema.europa.eu"].some(d => domain.includes(d))) {
      primary = "product_safety";
      confidence = Math.max(confidence, 0.85);
    }
    
    if (["nlrb.gov","osha.gov","dol.gov"].some(d => domain.includes(d))) {
      primary = "labor";
      confidence = Math.max(confidence, 0.85);
    }
    
    if (["epa.gov","ec.europa.eu"].some(d => domain.includes(d)) || /environment\.gov/i.test(domain)) {
      primary = "environment";
      confidence = Math.max(confidence, 0.85);
    }

    // FIXED: Only classify as noise if it's truly financial noise
    // Be much more restrictive about what counts as noise
    const financeNoiseDomains = ["fool.com","seekingalpha.com","benzinga.com","marketwatch.com","zacks.com","tipranks.com"];
    const isFinanceNoiseDomain = financeNoiseDomains.some(d => domain.includes(d));
    const hasStockTipPhrases = /reasons to buy|stock to watch|price target|upgrade|downgrade|analyst rating|buy rating|sell rating|earnings beat|earnings miss|quarterly results|revenue guidance/i.test(text);
    
    // Only mark as noise if BOTH conditions are met, or it's purely stock tips
    const isPurelyFinancialNews = primary === "financial" && isFinanceNoiseDomain && hasStockTipPhrases;
    if (isPurelyFinancialNews) {
      primary = "noise";
    }

    // Map to existing category_code format
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

    const finalCategoryCode = categoryCodeMap[primary] || "SOCIAL.CAMPAIGN"; // Default to social, not noise

    // Extract simple category for the category enum column
    const simpleCategoryMap: Record<string, string> = {
      "PRODUCT.RECALL": "social",
      "LABOR.SAFETY": "labor",
      "LABOR.DISCRIMINATION": "labor",
      "ESG.ENVIRONMENT": "environment",
      "POLICY.POLITICAL": "politics",
      "LEGAL.LAWSUIT": "social",
      "LEGAL.INVESTIGATION": "politics",
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

    // Detect orientation: positive, negative, or mixed
    const positiveSignals = [
      // Recognition & achievement
      "award", "certification", "honored", "recognized", "praised", "success", 
      "breakthrough", "innovation", "leadership", "achievement", "milestone",
      // Business wins
      "chooses", "selects", "partners", "exceeds", "improved",
      // Marketing/viral success
      "viral", "trending", "featured", "celebrates", "launches", "unveils",
      "introduces", "expands", "collaboration", "campaign", "official commercial",
      "brand ambassador", "sponsorship", "popularity", "fan favorite", "beloved",
      "tiktok", "social media hit", "goes viral", "record sales",
      // Business expansion & investment (NEW)
      "announces plans", "manufacturing site", "new facility", "new plant",
      "building", "construction", "headquarters", "opens new", "expansion plan",
      "job creation", "jobs created", "hiring", "new jobs", "create jobs",
      "investment", "investing", "invests", "committed to invest",
      // Innovation & R&D
      "cell therapy", "breakthrough therapy", "fda approval", "patent granted",
      "clinical trial success", "research center", "r&d facility", "approved by fda",
      // Community & social good
      "free fruit", "discount program", "community program", "charitable",
      "donation", "donates", "donated", "giving back", "supports community"
    ];
    const negativeSignals = ["lawsuit", "violation", "penalty", "fine", "recall", "scandal", "accused", "alleged", "investigation", "charged", "contamination", "injury", "death", "fraud", "failure", "misconduct", "negligence", "terminated", "layoff", "strike", "protest", "boycott", "complaint"];
    
    const textLower = text.toLowerCase();
    const positiveMatches = positiveSignals.filter(sig => textLower.includes(sig));
    const negativeMatches = negativeSignals.filter(sig => textLower.includes(sig));
    
    const hasPositive = positiveMatches.length > 0;
    const hasNegative = negativeMatches.length > 0;
    
    // Determine severity based on signal words
    const severitySignals = {
      critical: ["death", "deaths", "fatal", "fatality", "explosion", "criminal charges", "indictment", "fraud", "mass layoff"],
      severe: ["recall", "contamination", "injury", "injuries", "lawsuit", "investigation", "scandal", "accused", "charged"],
      moderate: ["fine", "penalty", "violation", "complaint", "dispute", "backlash", "criticism", "alleged", "strike", "layoff"],
      minor: ["settlement", "resolved", "clarification", "minor", "warning"]
    };
    
    type SeverityLevel = 'minor' | 'moderate' | 'severe' | 'critical';
    let severity: SeverityLevel = 'moderate';
    if (severitySignals.critical.some(s => textLower.includes(s))) severity = 'critical';
    else if (severitySignals.severe.some(s => textLower.includes(s))) severity = 'severe';
    else if (severitySignals.minor.some(s => textLower.includes(s))) severity = 'minor';
    
    // Determine orientation and impact magnitude
    let orientation: 'positive' | 'negative' | 'mixed' = 'mixed';
    let impactMagnitude = 0;
    
    if (primary === "noise") {
      orientation = 'mixed';
      impactMagnitude = 0;
    } else if (hasNegative && !hasPositive) {
      orientation = 'negative';
      // FIXED: Use whole number impacts that don't round to zero
      impactMagnitude = SEVERITY_IMPACTS[severity].negative;
    } else if (hasPositive && !hasNegative) {
      orientation = 'positive';
      impactMagnitude = SEVERITY_IMPACTS[severity].positive;
    } else if (hasNegative && hasPositive) {
      // Mixed signals - slight negative bias, reduced magnitude
      orientation = 'mixed';
      impactMagnitude = Math.round(SEVERITY_IMPACTS[severity].negative * 0.3);
    } else {
      // No clear signals - truly neutral, don't assume negative
      orientation = 'mixed';
      impactMagnitude = 0; // Neutral until proven otherwise
    }
    
    // Build category_impacts JSONB - THE CANONICAL SCORING FIELD
    // Each value is now a whole number (-15 to +4) that will actually affect scores
    const categoryImpacts: Record<string, number> = {
      labor: simpleCategory === "labor" ? impactMagnitude : 0,
      environment: simpleCategory === "environment" ? impactMagnitude : 0,
      politics: simpleCategory === "politics" ? impactMagnitude : 0,
      social: simpleCategory === "social" ? impactMagnitude : 0,
    };
    
    // Add secondary category impacts at 40% weight
    for (const sec of secondary) {
      const secCode = categoryCodeMap[sec];
      const secSimple = secCode ? simpleCategoryMap[secCode] : null;
      if (secSimple && secSimple !== simpleCategory && categoryImpacts[secSimple] !== undefined) {
        categoryImpacts[secSimple] = Math.round(impactMagnitude * 0.4);
      }
    }
    
    // Determine credibility based on domain
    const highCredDomains = ["reuters.com", "apnews.com", "bbc.com", "npr.org", "nytimes.com", "washingtonpost.com", "wsj.com", "ft.com"];
    const officialDomains = [".gov", "sec.gov", "epa.gov", "fda.gov", "osha.gov", "nlrb.gov", "ftc.gov", "doj.gov"];
    let credibility = 0.6;
    if (officialDomains.some(d => domain.includes(d))) credibility = 1.0;
    else if (highCredDomains.some(d => domain.includes(d))) credibility = 0.9;
    
    // Map to database severity enum
    const dbSeverity: 'minor' | 'moderate' | 'severe' = severity === 'critical' ? 'severe' : severity;
    
    // Legacy impact columns (for backwards compatibility)
    // These are now in the same scale as category_impacts
    const impactScores = {
      impact_labor: categoryImpacts.labor || 0,
      impact_environment: categoryImpacts.environment || 0,
      impact_politics: categoryImpacts.politics || 0,
      impact_social: categoryImpacts.social || 0,
    };

    // Persist to brand_events
    const { error: updateError } = await supabase
      .from("brand_events")
      .update({
        category: simpleCategory,
        category_code: finalCategoryCode,
        category_confidence: confidence,
        secondary_categories: secondary,
        orientation,
        is_irrelevant: primary === "noise",
        noise_reason: primary === "noise" ? "Pure financial/stock analysis" : null,
        severity: dbSeverity,
        credibility,
        verification_factor: 0.5,
        category_impacts: categoryImpacts,
        ...impactScores,
      })
      .eq("event_id", event_id)
      .eq("brand_id", brand_id);

    if (updateError) {
      console.error("[categorize-event] Update error:", updateError);
      throw updateError;
    }

    console.log(`[categorize-event] ${event_id}: ${finalCategoryCode} | ${orientation} | severity=${severity} | impacts=${JSON.stringify(categoryImpacts)} | confidence=${confidence.toFixed(2)}`);

    return new Response(
      JSON.stringify({ 
        primary: finalCategoryCode, 
        secondary, 
        confidence,
        orientation,
        severity,
        categoryImpacts,
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
