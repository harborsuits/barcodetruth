import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { limit = 80 } = await req.json().catch(() => ({}));

    // Source brands: ready + active (any brand a user might scan)
    const { data: sourceBrands } = await sb
      .from("brands")
      .select("id, name, parent_company, company_type, category_slug, subcategory_slug, status")
      .in("status", ["active", "ready"])
      .limit(800);

    if (!sourceBrands || sourceBrands.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, computed: 0, message: "No eligible brands" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Candidate alternatives: active only (quality-gated)
    const candidateBrands = sourceBrands.filter((b: any) => b.status === "active");

    const allBrandIds = sourceBrands.map((b: any) => b.id);

    // Get all scores in one query
    const { data: allScores } = await sb
      .from("brand_scores")
      .select("brand_id, score, score_labor, score_environment, score_politics, score_social")
      .in("brand_id", allBrandIds);

    const scoreMap: Record<string, any> = {};
    for (const s of allScores || []) {
      scoreMap[s.brand_id] = s;
    }

    let computed = 0;
    const errors: string[] = [];
    const targetBrands = sourceBrands.slice(0, Math.min(limit, sourceBrands.length));

    let skippedNoScore = 0;
    let skippedNoPeers = 0;
    let skippedNoFinal = 0;

    for (const brand of targetBrands) {
      try {
        const brandScore = scoreMap[brand.id];
        if (!brandScore?.score) { skippedNoScore++; continue; }

        // Find peers: active-only candidates EXCEPT same parent company
        const peers = candidateBrands.filter((p: any) => {
          if (p.id === brand.id) return false;
          if (brand.parent_company && p.parent_company &&
              brand.parent_company.toLowerCase() === p.parent_company.toLowerCase()) {
            return false;
          }
          if (!scoreMap[p.id]?.score) return false;
          return true;
        });

        if (peers.length === 0) { skippedNoPeers++; continue; }

        // === HARD RANKING HIERARCHY ===
        // Tier 1: exact subcategory match (+25)
        // Tier 2: same category only (+10), with penalty if subcategory exists but doesn't match (-5)
        // Tier 3: general independent (no category bonus)
        const rankedPeers = peers
          .map((p: any) => {
            const ps = scoreMap[p.id];

            // Independence bonus
            let independenceBonus = 0;
            const ct = (p.company_type || "").toLowerCase();
            if (ct === "independent" || ct === "local" || ct === "cooperative") independenceBonus = 8;
            else if (ct === "nonprofit") independenceBonus = 7;
            else if (ct === "private") independenceBonus = 4;
            else if (ct === "public") independenceBonus = 2;

            // Subcategory match: highest priority
            let subcategoryBonus = 0;
            const exactSubcategoryMatch = brand.subcategory_slug && p.subcategory_slug &&
                brand.subcategory_slug === p.subcategory_slug;
            if (exactSubcategoryMatch) {
              subcategoryBonus = 25;
            }

            // Category match: fallback
            let categoryBonus = 0;
            let wrongSubcategoryPenalty = 0;
            const sameCat = brand.category_slug && p.category_slug &&
                brand.category_slug === p.category_slug;

            if (subcategoryBonus === 0 && sameCat) {
              categoryBonus = 10;
              // Penalty: both have subcategories but they differ (wrong niche)
              if (brand.subcategory_slug && p.subcategory_slug &&
                  brand.subcategory_slug !== p.subcategory_slug) {
                wrongSubcategoryPenalty = -5;
              }
            }

            // Determine match reason for debug
            let matchReason = "general_independent";
            if (exactSubcategoryMatch) matchReason = "matched_subcategory";
            else if (sameCat) matchReason = "matched_category";

            return {
              ...p,
              peerScore: ps,
              sameSubcategory: !!exactSubcategoryMatch,
              sameCategory: !!sameCat,
              matchReason,
              rankScore: (ps.score || 50) + independenceBonus + subcategoryBonus + categoryBonus + wrongSubcategoryPenalty,
            };
          })
          .sort((a: any, b: any) => b.rankScore - a.rankScore);

        // === GUARDRAIL: prefer fewer but cleaner ===
        // If we have 3+ exact subcategory matches, only use those + top category matches
        const subcatMatches = rankedPeers.filter((p: any) => p.sameSubcategory);
        const catMatches = rankedPeers.filter((p: any) => !p.sameSubcategory && p.sameCategory);
        const generalMatches = rankedPeers.filter((p: any) => !p.sameSubcategory && !p.sameCategory);

        let finalPeers: any[];
        if (subcatMatches.length >= 3) {
          // Strong subcategory pool: prioritize these, add a few category matches
          finalPeers = [...subcatMatches.slice(0, 6), ...catMatches.slice(0, 2)];
        } else {
          // Thin subcategory: use what we have, then category, then general
          finalPeers = [
            ...subcatMatches,
            ...catMatches.slice(0, 6 - subcatMatches.length),
            ...generalMatches.slice(0, Math.max(0, 3 - subcatMatches.length - catMatches.length)),
          ];
        }

        // Cap at 8
        finalPeers = finalPeers.slice(0, 8);

        if (finalPeers.length === 0) { skippedNoFinal++; continue; }

        const altRows = finalPeers.map((peer: any) => {
          const reasons: string[] = [];
          const ps = peer.peerScore;

          if (ps.score > brandScore.score)
            reasons.push("Higher overall trust score");
          if (ps.score_environment > (brandScore.score_environment || 50))
            reasons.push("Better environmental record");
          if (ps.score_labor > (brandScore.score_labor || 50))
            reasons.push("Better labor practices");
          if (!peer.parent_company)
            reasons.push("Independent brand");

          // Append match reason for debug
          const debugTag = `[${peer.matchReason}]`;
          const reasonText = reasons.length > 0 ? `${reasons[0]} ${debugTag}` : `Competitive trust score ${debugTag}`;

          return {
            brand_id: brand.id,
            alternative_brand_id: peer.id,
            reason: reasonText,
            score: ps.score || 50,
            alternative_type: "precomputed",
          };
        });

        if (altRows.length > 0) {
          await sb
            .from("brand_alternatives")
            .delete()
            .eq("brand_id", brand.id)
            .eq("alternative_type", "precomputed");

          const { error } = await sb.from("brand_alternatives").insert(altRows);
          if (error) {
            errors.push(`${brand.name}: ${error.message}`);
          } else {
            computed++;
          }
        }
      } catch (e: any) {
        errors.push(`${brand.name}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        computed,
        total_candidates: targetBrands.length,
        skippedNoScore,
        skippedNoPeers,
        skippedNoFinal,
        candidatePoolSize: candidateBrands.length,
        scoresLoaded: Object.keys(scoreMap).length,
        errors: errors.slice(0, 5),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
