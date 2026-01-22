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
  const primary = arr[0]?.[0] ?? "social";
  const primaryScore = arr[0]?.[1] ?? 0;
  const maxScore = Math.max(primaryScore, 10);
  const confidence = Math.max(CONF_MIN, Math.min(CONF_MAX, primaryScore / (maxScore + 4)));

  const secondary = arr.slice(1).filter(([, v]) => v >= SECONDARY_MIN).map(([k]) => k);
  return { primary, secondary, confidence };
}

// Inline categorization logic (same as categorize-event)
function categorizeEvent(title: string, description: string, sourceDomain: string) {
  const text = [title, description, sourceDomain].filter(Boolean).join(" • ");
  const scores = tokenScore(text);
  let { primary, secondary, confidence } = rank(scores);

  const domain = (sourceDomain || "").toLowerCase();
  
  // Domain hints
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

  // Noise detection
  const financeNoiseDomains = ["fool.com","seekingalpha.com","benzinga.com","marketwatch.com","zacks.com","tipranks.com"];
  const isFinanceNoiseDomain = financeNoiseDomains.some(d => domain.includes(d));
  const hasStockTipPhrases = /reasons to buy|stock to watch|price target|upgrade|downgrade|analyst rating/i.test(text);
  
  if (primary === "financial" && isFinanceNoiseDomain && hasStockTipPhrases) {
    primary = "noise";
  }

  // Category code mapping
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
  const finalCategoryCode = categoryCodeMap[primary] || "SOCIAL.CAMPAIGN";

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

  // Orientation detection - EXPANDED positive signals
  const positiveSignals = [
    "award", "certification", "honored", "recognized", "praised", "success", 
    "breakthrough", "innovation", "leadership", "achievement", "milestone",
    "chooses", "selects", "partners", "exceeds", "improved",
    "viral", "trending", "featured", "celebrates", "launches", "unveils",
    "introduces", "expands", "collaboration", "campaign", "official commercial",
    "brand ambassador", "sponsorship", "popularity", "fan favorite", "beloved",
    "tiktok", "social media hit", "goes viral", "record sales",
    // Business expansion
    "announces plans", "manufacturing site", "new facility", "new plant",
    "building", "construction", "headquarters", "opens new", "expansion plan",
    "job creation", "jobs created", "hiring", "new jobs", "create jobs",
    "investment", "investing", "invests", "committed to invest",
    // Innovation
    "cell therapy", "breakthrough therapy", "fda approval", "patent granted",
    "clinical trial success", "research center", "r&d facility", "approved by fda",
    // Community
    "free fruit", "discount program", "community program", "charitable",
    "donation", "donates", "donated", "giving back", "supports community"
  ];
  const negativeSignals = ["lawsuit", "violation", "penalty", "fine", "recall", "scandal", "accused", "alleged", "investigation", "charged", "contamination", "injury", "death", "fraud", "failure", "misconduct", "negligence", "terminated", "layoff", "strike", "protest", "boycott", "complaint"];
  
  const textLower = text.toLowerCase();
  const hasPositive = positiveSignals.some(sig => textLower.includes(sig));
  const hasNegative = negativeSignals.some(sig => textLower.includes(sig));
  
  // Severity detection
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
  
  // Orientation and impact
  let orientation: 'positive' | 'negative' | 'mixed' = 'mixed';
  let impactMagnitude = 0;
  
  if (primary === "noise") {
    orientation = 'mixed';
    impactMagnitude = 0;
  } else if (hasNegative && !hasPositive) {
    orientation = 'negative';
    impactMagnitude = SEVERITY_IMPACTS[severity].negative;
  } else if (hasPositive && !hasNegative) {
    orientation = 'positive';
    impactMagnitude = SEVERITY_IMPACTS[severity].positive;
  } else if (hasNegative && hasPositive) {
    orientation = 'mixed';
    impactMagnitude = Math.round(SEVERITY_IMPACTS[severity].negative * 0.3);
  } else {
    orientation = 'mixed';
    impactMagnitude = 0;
  }
  
  // Build impacts
  const categoryImpacts: Record<string, number> = {
    labor: simpleCategory === "labor" ? impactMagnitude : 0,
    environment: simpleCategory === "environment" ? impactMagnitude : 0,
    politics: simpleCategory === "politics" ? impactMagnitude : 0,
    social: simpleCategory === "social" ? impactMagnitude : 0,
  };
  
  for (const sec of secondary) {
    const secCode = categoryCodeMap[sec];
    const secSimple = secCode ? simpleCategoryMap[secCode] : null;
    if (secSimple && secSimple !== simpleCategory && categoryImpacts[secSimple] !== undefined) {
      categoryImpacts[secSimple] = Math.round(impactMagnitude * 0.4);
    }
  }
  
  // Credibility
  const highCredDomains = ["reuters.com", "apnews.com", "bbc.com", "npr.org", "nytimes.com", "washingtonpost.com", "wsj.com", "ft.com"];
  const officialDomains = [".gov", "sec.gov", "epa.gov", "fda.gov", "osha.gov", "nlrb.gov", "ftc.gov", "doj.gov"];
  let credibility = 0.6;
  if (officialDomains.some(d => domain.includes(d))) credibility = 1.0;
  else if (highCredDomains.some(d => domain.includes(d))) credibility = 0.9;
  
  const dbSeverity: 'minor' | 'moderate' | 'severe' = severity === 'critical' ? 'severe' : severity;

  return {
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
    impact_labor: categoryImpacts.labor || 0,
    impact_environment: categoryImpacts.environment || 0,
    impact_politics: categoryImpacts.politics || 0,
    impact_social: categoryImpacts.social || 0,
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

    const { limit = 200, onlyMixedZero = true, triggerRecompute = true } = await req.json().catch(() => ({}));

    console.log(`[batch-recategorize] Starting with limit=${limit}, onlyMixedZero=${onlyMixedZero}, triggerRecompute=${triggerRecompute}`);

    // Query events to recategorize
    let query = supabase
      .from("brand_events")
      .select("event_id, brand_id, title, description, source_url, orientation, impact_labor, impact_environment, impact_politics, impact_social")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (onlyMixedZero) {
      // Only process mixed orientation events with zero impacts
      query = query
        .eq("orientation", "mixed")
        .eq("impact_labor", 0)
        .eq("impact_environment", 0)
        .eq("impact_politics", 0)
        .eq("impact_social", 0);
    }

    const { data: events, error: fetchError } = await query;

    if (fetchError) {
      console.error("[batch-recategorize] Fetch error:", fetchError);
      throw fetchError;
    }

    if (!events || events.length === 0) {
      console.log("[batch-recategorize] No events to process");
      return new Response(
        JSON.stringify({
          success: true,
          total_processed: 0,
          changed_to_positive: 0,
          changed_to_negative: 0,
          remained_mixed: 0,
          brands_affected: 0,
          recompute_triggered: false
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[batch-recategorize] Processing ${events.length} events`);

    let changedToPositive = 0;
    let changedToNegative = 0;
    let remainedMixed = 0;
    let errors = 0;
    const affectedBrands = new Set<string>();

    for (const event of events) {
      try {
        // Extract domain from source_url
        let sourceDomain = "";
        try {
          if (event.source_url) {
            sourceDomain = new URL(event.source_url).hostname;
          }
        } catch { /* ignore */ }

        // Run categorization
        const result = categorizeEvent(
          event.title || "",
          event.description || "",
          sourceDomain
        );

        // Check if orientation changed
        const oldOrientation = event.orientation;
        const newOrientation = result.orientation;

        if (newOrientation === 'positive' && oldOrientation !== 'positive') {
          changedToPositive++;
        } else if (newOrientation === 'negative' && oldOrientation !== 'negative') {
          changedToNegative++;
        } else {
          remainedMixed++;
        }

        // Update the event
        const { error: updateError } = await supabase
          .from("brand_events")
          .update(result)
          .eq("event_id", event.event_id);

        if (updateError) {
          console.error(`[batch-recategorize] Update error for ${event.event_id}:`, updateError);
          errors++;
        } else {
          affectedBrands.add(event.brand_id);
        }

      } catch (err: any) {
        console.error(`[batch-recategorize] Error processing ${event.event_id}:`, err);
        errors++;
      }
    }

    console.log(`[batch-recategorize] Processed: ${events.length}, Positive: ${changedToPositive}, Negative: ${changedToNegative}, Mixed: ${remainedMixed}, Errors: ${errors}`);

    // Trigger recompute for affected brands
    let recomputeTriggered = false;
    if (triggerRecompute && affectedBrands.size > 0) {
      console.log(`[batch-recategorize] Triggering recompute for ${affectedBrands.size} brands`);
      
      for (const brandId of affectedBrands) {
        try {
          await supabase.functions.invoke('recompute-brand-scores', {
            body: { brand_id: brandId }
          });
          // Small delay to avoid overwhelming the system
          await new Promise(r => setTimeout(r, 50));
        } catch (err) {
          console.error(`[batch-recategorize] Recompute error for ${brandId}:`, err);
        }
      }
      recomputeTriggered = true;
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_processed: events.length,
        changed_to_positive: changedToPositive,
        changed_to_negative: changedToNegative,
        remained_mixed: remainedMixed,
        errors,
        brands_affected: affectedBrands.size,
        recompute_triggered: recomputeTriggered
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[batch-recategorize] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
