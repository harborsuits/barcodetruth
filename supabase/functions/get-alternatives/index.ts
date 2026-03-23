import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand_id, type = "green", user_weights, region } = await req.json();

    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: "brand_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get current brand info
    const { data: currentBrand } = await supabase
      .from("brands")
      .select("id, name, category_slug, parent_company")
      .eq("id", brand_id)
      .single();

    if (!currentBrand) {
      return new Response(
        JSON.stringify({ alternatives: [], reason: "Brand not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check precomputed alternatives first
    const { data: precomputed } = await supabase.rpc("get_brand_alternatives", {
      p_brand_id: brand_id,
      p_type: type,
    });

    if (precomputed && precomputed.length > 0) {
      return new Response(
        JSON.stringify({ alternatives: precomputed, source: "precomputed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Dynamic alternatives: query brands with scores, filtered by type
    let query = supabase
      .from("brands")
      .select(`
        id, name, parent_company, logo_url, category_slug,
        brand_scores!inner(score_labor, score_environment, score_politics, score_social)
      `)
      .eq("is_active", true)
      .neq("id", brand_id)
      .not("brand_scores", "is", null)
      .limit(50);

    // Filter by same category if available
    if (currentBrand.category_slug) {
      query = query.eq("category_slug", currentBrand.category_slug);
    }

    const { data: candidates, error } = await query;

    if (error || !candidates || candidates.length === 0) {
      // Fallback: get top-scored brands regardless of category
      const { data: fallback } = await supabase
        .from("brands")
        .select(`
          id, name, parent_company, logo_url, category_slug,
          brand_scores!inner(score_labor, score_environment, score_politics, score_social)
        `)
        .eq("is_active", true)
        .neq("id", brand_id)
        .limit(30);

      if (!fallback || fallback.length === 0) {
        return new Response(
          JSON.stringify({ alternatives: [], reason: "Insufficient data" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          alternatives: rankAlternatives(fallback, type, user_weights),
          source: "dynamic_fallback",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Rank by type
    const ranked = rankAlternatives(candidates, type, user_weights);

    return new Response(
      JSON.stringify({ alternatives: ranked, source: "dynamic" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("get-alternatives error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", alternatives: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface CandidateBrand {
  id: string;
  name: string;
  parent_company: string | null;
  logo_url: string | null;
  category_slug: string | null;
  brand_scores: {
    score_labor: number | null;
    score_environment: number | null;
    score_politics: number | null;
    score_social: number | null;
  };
}

interface UserWeights {
  labor?: number;
  environment?: number;
  politics?: number;
  social?: number;
}

function rankAlternatives(
  candidates: CandidateBrand[],
  type: string,
  userWeights?: UserWeights
) {
  const weights = {
    labor: userWeights?.labor ?? 50,
    environment: userWeights?.environment ?? 50,
    politics: userWeights?.politics ?? 50,
    social: userWeights?.social ?? 50,
  };

  const scored = candidates.map((c) => {
    const scores = Array.isArray(c.brand_scores)
      ? c.brand_scores[0]
      : c.brand_scores;
    const sl = scores?.score_labor ?? 50;
    const se = scores?.score_environment ?? 50;
    const sp = scores?.score_politics ?? 50;
    const ss = scores?.score_social ?? 50;

    let rankScore = 0;
    let reason = "";

    switch (type) {
      case "green":
        // Weight environment heavily
        rankScore = se * 3 + sl + sp + ss;
        reason =
          se >= 70
            ? `Strong environmental record (${se}/100)`
            : se >= 50
            ? `Above-average environmental practices (${se}/100)`
            : `Environment score: ${se}/100`;
        break;

      case "local":
        // For local, use overall balanced score (region filtering done at DB level)
        rankScore = (sl + se + sp + ss) / 4;
        reason = `Overall alignment score: ${Math.round(rankScore)}/100`;
        break;

      case "political":
        // Weight politics heavily
        rankScore = sp * 3 + sl + se + ss;
        reason =
          sp >= 70
            ? `Strong political alignment (${sp}/100)`
            : sp >= 50
            ? `Moderate political stance (${sp}/100)`
            : `Politics score: ${sp}/100`;
        break;

      default:
        // Weighted by user preferences
        const totalW =
          weights.labor + weights.environment + weights.politics + weights.social || 200;
        rankScore =
          (sl * weights.labor +
            se * weights.environment +
            sp * weights.politics +
            ss * weights.social) /
          totalW;
        reason = `Personalized match: ${Math.round(rankScore)}/100`;
    }

    return {
      brand_id: c.id,
      brand_name: c.name,
      parent_company: c.parent_company,
      logo_url: c.logo_url,
      reason,
      score: Math.round(rankScore * 100) / 100,
      score_environment: se,
      score_labor: sl,
      score_politics: sp,
      score_social: ss,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10);
}
