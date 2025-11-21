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

    // persist to brand_events
    const { error: updateError } = await supabase
      .from("brand_events")
      .update({
        category: simpleCategory,          // ← FIX: populate enum column for scorer
        category_code: finalCategoryCode,  // Keep detailed code
        category_confidence: confidence,
        secondary_categories: secondary,
        noise_reason: primary === "noise" ? "Stock tips/market chatter" : null
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
