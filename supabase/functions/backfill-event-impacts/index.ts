import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CATEGORY_KEYWORDS, NEGATIVE_GUARDS } from "../_shared/keywords.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Constants
const BATCH_SIZE = 100;
const LOOKBACK_DAYS = 365; // Extended to 365 days for full backfill

// FIXED: Impact magnitudes respect db constraint be_impact_bounds (-5 to +5)
const SEVERITY_IMPACTS = {
  minor: { negative: -1, positive: 1 },
  moderate: { negative: -3, positive: 2 },
  severe: { negative: -5, positive: 3 },
  critical: { negative: -5, positive: 4 }, // Capped at -5 due to constraint
};

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
  const primary = arr[0]?.[0] ?? "social"; // Default to social, not noise
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
  "LEGAL.INVESTIGATION": "politics",
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

  // Domain hints - official sources override
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

  // FIXED: Much more restrictive noise classification
  const financeNoiseDomains = ["fool.com","seekingalpha.com","benzinga.com","marketwatch.com","zacks.com","tipranks.com"];
  const isFinanceNoiseDomain = financeNoiseDomains.some(d => domain.includes(d));
  const hasStockTipPhrases = /reasons to buy|stock to watch|price target|upgrade|downgrade|analyst rating|quarterly results|revenue guidance/i.test(text);
  
  // Only noise if BOTH conditions met
  if (primary === "financial" && isFinanceNoiseDomain && hasStockTipPhrases) {
    primary = "noise";
  }

  const finalCategoryCode = categoryCodeMap[primary] || "SOCIAL.CAMPAIGN";
  const simpleCategory = simpleCategoryMap[finalCategoryCode] || "social";

  // Orientation detection
  // EXPANDED POSITIVE SIGNALS (10 → 50 keywords)
  const positiveSignals = [
    // Recognition
    "award", "awarded", "awards", "certification", "certified", "honored",
    "recognized", "recognition", "praised", "commended", "accolade",
    // Innovation/Progress
    "breakthrough", "innovation", "innovative", "pioneering",
    "first-of-its-kind", "industry-first", "launched successfully",
    "achievement", "achievements", "milestone",
    // Growth/Success
    "record profit", "beat expectations", "exceeded targets",
    "surpassed", "outperformed", "exceeds expectations",
    // Sustainability Achievements
    "carbon neutral", "net zero achieved", "renewable energy commitment",
    "sustainability award", "green certification", "b corp certified",
    "sustainability milestone", "eco-friendly", "zero waste"
  ];
  
  // EXPANDED NEGATIVE SIGNALS (70 → 120+ keywords)
  const negativeSignals = [
    // Legal/Compliance (high confidence)
    "lawsuit", "sued", "suing", "violation", "violated", "violating",
    "penalty", "penalties", "fine", "fined", "fining", "settlement",
    "litigation", "convicted", "guilty", "plea deal", "indicted", "indictment",
    "class action", "punitive damages", "legal action", "consent decree",
    // Scandals/Misconduct
    "scandal", "fraud", "fraudulent", "misconduct", "corrupt", "corruption",
    "bribery", "investigation", "investigating", "probe", "alleged", "accused",
    "charged", "charges", "coverup", "cover-up", "whistleblower",
    // Safety/Health
    "recall", "recalled", "recalling", "contamination", "contaminated",
    "injury", "injuries", "injured", "death", "deaths", "fatality", "fatalities",
    "hazard", "hazardous", "unsafe", "warning letter", "outbreak", "withdrawn",
    "poisoning", "illness", "sickened", "hospitalized", "toxic",
    // Labor Issues
    "layoff", "layoffs", "laid off", "job cuts", "workforce reduction",
    "downsizing", "walkout", "union dispute", "unfair labor", "wage theft",
    "discrimination", "harassment", "wrongful termination", "fired", "terminated",
    "sweatshop", "child labor", "forced labor", "exploitation", "wage violation",
    // Regulatory Citations (INDUSTRY-SPECIFIC)
    "osha citation", "osha fine", "osha violation", "workplace safety violation",
    "epa violation", "epa fine", "epa penalty", "environmental violation",
    "fda warning", "fda citation", "warning letter", "consent order",
    "ftc complaint", "doj investigation", "sec investigation", "regulatory action",
    // Business Failure
    "bankruptcy", "chapter 11", "receivership", "restructuring",
    "closure", "closes", "closing", "closed", "shutting down", "ceased operations",
    // Public Backlash
    "boycott", "backlash", "outrage", "protest", "protests", "condemned",
    "criticism", "criticized", "controversy", "controversial",
    // Financial Misconduct
    "price fixing", "antitrust", "monopoly", "cartel", "bid rigging",
    "securities fraud", "insider trading", "tax evasion", "money laundering",
    // Privacy/Data
    "data breach", "hack", "hacked", "leaked", "exposed", "privacy violation",
    "security incident", "ransomware", "cyberattack"
  ];
  
  const textLower = text.toLowerCase();
  let hasPositive = positiveSignals.some(sig => textLower.includes(sig));
  let hasNegative = negativeSignals.some(sig => textLower.includes(sig));

  // Domain-based orientation hints
  const regulatoryDomains = ["epa.gov", "osha.gov", "nlrb.gov", "dol.gov", "ftc.gov", "sec.gov", "fda.gov"];
  const investigativeDomains = ["propublica.org", "icij.org"];
  const isRegulatoryDomain = regulatoryDomains.some(d => domain.includes(d));
  const isInvestigativeDomain = investigativeDomains.some(d => domain.includes(d));

  // Regulatory/investigative sources without positive signals = likely negative
  if ((isRegulatoryDomain || isInvestigativeDomain) && !hasPositive) {
    // Check it's NOT an award/recognition page
    if (!textLower.includes('award') && !textLower.includes('recognition') && !textLower.includes('approved')) {
      hasNegative = true; // Force negative orientation
    }
  }

  // Severity detection
  const severitySignals = {
    critical: ["death", "deaths", "fatal", "explosion", "criminal charges", "indictment", "fraud", "mass layoff"],
    severe: ["recall", "contamination", "injury", "injuries", "lawsuit", "investigation", "scandal", "charged"],
    moderate: ["fine", "penalty", "violation", "complaint", "dispute", "backlash", "layoff"],
    minor: ["settlement", "resolved", "clarification", "minor", "warning"]
  };
  
  type SeverityLevel = 'minor' | 'moderate' | 'severe' | 'critical';
  let severity: SeverityLevel = 'moderate';
  if (severitySignals.critical.some(s => textLower.includes(s))) severity = 'critical';
  else if (severitySignals.severe.some(s => textLower.includes(s))) severity = 'severe';
  else if (severitySignals.minor.some(s => textLower.includes(s))) severity = 'minor';

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
    // NO SIGNALS MATCHED - but event is categorized (not noise)
    // Give meaningful impact to register brand activity (INCREASED from 0.1x to 0.25x)
    orientation = 'mixed';
    const baseImpact = SEVERITY_IMPACTS[severity].negative * 0.25;
    impactMagnitude = Math.round(baseImpact) || -2; // Minimum -2 to ensure scoring impact
  }

  // Build category impacts with whole numbers
  const categoryImpacts: Record<string, number> = {
    labor: simpleCategory === "labor" ? impactMagnitude : 0,
    environment: simpleCategory === "environment" ? impactMagnitude : 0,
    politics: simpleCategory === "politics" ? impactMagnitude : 0,
    social: simpleCategory === "social" ? impactMagnitude : 0,
  };

  // Secondary impacts at 40% weight
  for (const sec of secondary) {
    const secCode = categoryCodeMap[sec];
    const secSimple = secCode ? simpleCategoryMap[secCode] : null;
    if (secSimple && secSimple !== simpleCategory && categoryImpacts[secSimple] !== undefined) {
      categoryImpacts[secSimple] = Math.round(impactMagnitude * 0.4);
    }
  }

  // Credibility
  const highCredDomains = ["reuters.com", "apnews.com", "bbc.com", "npr.org", "nytimes.com", "wsj.com"];
  const officialDomains = [".gov"];
  let credibility = 0.6;
  if (officialDomains.some(d => domain.includes(d))) credibility = 1.0;
  else if (highCredDomains.some(d => domain.includes(d))) credibility = 0.9;

  // Map to DB severity enum
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

    const { batchSize = BATCH_SIZE, dryRun = false, forceAll = false } = await req.json().catch(() => ({}));

    console.log(`[backfill-event-impacts] Starting backfill (batch=${batchSize}, dryRun=${dryRun}, forceAll=${forceAll})`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LOOKBACK_DAYS);

    // Build query - either all events or just those without impacts
    let query = supabase
      .from("brand_events")
      .select("event_id, brand_id, title, description, article_text, source_url")
      .gte("created_at", cutoffDate.toISOString());
    
    if (!forceAll) {
      // Only events with empty/null category_impacts
      query = query.or("category_impacts.is.null,category_impacts.eq.{}");
    }
    
    const { data: events, error: fetchError } = await query.limit(batchSize);

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
    const stats = { 
      noise: 0, 
      labor: 0, 
      environment: 0, 
      politics: 0, 
      social: 0,
      positive: 0,
      negative: 0,
      mixed: 0,
      impactDistribution: { zero: 0, minor: 0, moderate: 0, severe: 0 }
    };

    for (const event of events) {
      try {
        const classification = classifyEvent(event as EventRow);
        
        // Track category stats
        if (classification.is_irrelevant) {
          stats.noise++;
        } else {
          stats[classification.category as keyof typeof stats]++;
        }
        
        // Track orientation stats
        stats[classification.orientation]++;
        
        // Track impact distribution
        const maxImpact = Math.abs(Math.min(
          classification.impact_labor,
          classification.impact_environment,
          classification.impact_politics,
          classification.impact_social
        ));
        if (maxImpact === 0) stats.impactDistribution.zero++;
        else if (maxImpact <= 2) stats.impactDistribution.minor++;
        else if (maxImpact <= 5) stats.impactDistribution.moderate++;
        else stats.impactDistribution.severe++;

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

    const noisePercentage = events.length > 0 ? ((stats.noise / events.length) * 100).toFixed(1) : "0";
    console.log(`[backfill-event-impacts] Complete: updated=${updated}, failed=${failed}`);
    console.log(`[backfill-event-impacts] Categories: labor=${stats.labor}, env=${stats.environment}, politics=${stats.politics}, social=${stats.social}, noise=${stats.noise} (${noisePercentage}%)`);
    console.log(`[backfill-event-impacts] Orientations: positive=${stats.positive}, negative=${stats.negative}, mixed=${stats.mixed}`);
    console.log(`[backfill-event-impacts] Impact distribution: ${JSON.stringify(stats.impactDistribution)}`);

    return new Response(JSON.stringify({
      success: true,
      processed: events.length,
      updated,
      failed,
      dryRun,
      noisePercentage: parseFloat(noisePercentage),
      categoryStats: {
        labor: stats.labor,
        environment: stats.environment,
        politics: stats.politics,
        social: stats.social,
        noise: stats.noise
      },
      orientationStats: {
        positive: stats.positive,
        negative: stats.negative,
        mixed: stats.mixed
      },
      impactDistribution: stats.impactDistribution
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
