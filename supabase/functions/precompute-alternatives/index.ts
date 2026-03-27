import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ── Classification helpers ── */

function getIndependenceBonus(companyType: string): number {
  const ct = (companyType || "").toLowerCase();
  if (ct === "independent" || ct === "local" || ct === "cooperative") return 8;
  if (ct === "nonprofit") return 7;
  if (ct === "private") return 4;
  if (ct === "public") return 2;
  return 0;
}

/** 3 = indie/private/nonprofit, 2 = public-ok, 1 = subsidiary/conglomerate */
function getBetterOptionClass(companyType: string): number {
  const ct = (companyType || "").toLowerCase();
  if (["independent", "local", "cooperative", "nonprofit"].includes(ct)) return 3;
  if (ct === "private") return 3;
  if (ct === "public") return 2;
  return 1; // subsidiary, conglomerate, unknown
}

function getBigBrandPenalty(companyType: string, lane: "better" | "similar"): number {
  if (lane === "similar") return 0; // no penalty in similar lane
  const ct = (companyType || "").toLowerCase();
  if (ct === "subsidiary" || ct === "conglomerate") return -12;
  if (ct === "public") return -4;
  return 0;
}

/* ── Ranking ── */

interface RankedPeer {
  id: string;
  name: string;
  parent_company: string | null;
  company_type: string | null;
  category_slug: string | null;
  subcategory_slug: string | null;
  status: string;
  peerScore: any;
  sameSubcategory: boolean;
  sameCategory: boolean;
  matchReason: string;
  betterOptionClass: number;
  rankScore: number;
}

function rankPeers(
  brand: any,
  peers: any[],
  scoreMap: Record<string, any>,
  lane: "better" | "similar"
): RankedPeer[] {
  return peers
    .map((p) => {
      const ps = scoreMap[p.id];
      if (!ps?.score) return null;

      const independenceBonus = getIndependenceBonus(p.company_type || "");
      const bigBrandPenalty = getBigBrandPenalty(p.company_type || "", lane);
      const betterOptionClass = getBetterOptionClass(p.company_type || "");

      // Subcategory match: highest priority
      const exactSubcategoryMatch =
        brand.subcategory_slug &&
        p.subcategory_slug &&
        brand.subcategory_slug === p.subcategory_slug;
      const subcategoryBonus = exactSubcategoryMatch ? 25 : 0;

      // Category match: fallback
      const sameCat =
        brand.category_slug &&
        p.category_slug &&
        brand.category_slug === p.category_slug;
      let categoryBonus = 0;
      let wrongSubcategoryPenalty = 0;
      if (!exactSubcategoryMatch && sameCat) {
        categoryBonus = 10;
        if (
          brand.subcategory_slug &&
          p.subcategory_slug &&
          brand.subcategory_slug !== p.subcategory_slug
        ) {
          wrongSubcategoryPenalty = -5;
        }
      }

      const matchReason = exactSubcategoryMatch
        ? "matched_subcategory"
        : sameCat
        ? "matched_category"
        : "general_independent";

      return {
        ...p,
        peerScore: ps,
        sameSubcategory: !!exactSubcategoryMatch,
        sameCategory: !!sameCat,
        matchReason,
        betterOptionClass,
        rankScore:
          (ps.score || 50) +
          independenceBonus +
          subcategoryBonus +
          categoryBonus +
          wrongSubcategoryPenalty +
          bigBrandPenalty,
      } as RankedPeer;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      // Primary: subcategory match first
      if (a.sameSubcategory !== b.sameSubcategory)
        return a.sameSubcategory ? -1 : 1;
      // Secondary (better lane only): betterOptionClass
      if (lane === "better" && a.betterOptionClass !== b.betterOptionClass)
        return b.betterOptionClass - a.betterOptionClass;
      // Tertiary: rankScore
      return b.rankScore - a.rankScore;
    }) as RankedPeer[];
}

/** Apply "fewer but cleaner" guardrail and cap */
function selectFinal(ranked: RankedPeer[], maxResults: number): RankedPeer[] {
  const subcatMatches = ranked.filter((p) => p.sameSubcategory);
  const catMatches = ranked.filter((p) => !p.sameSubcategory && p.sameCategory);
  const general = ranked.filter((p) => !p.sameSubcategory && !p.sameCategory);

  let finalPeers: RankedPeer[];
  if (subcatMatches.length >= 3) {
    // Strong subcategory pool: prioritize, add a couple category fallbacks
    finalPeers = [
      ...subcatMatches.slice(0, maxResults - 1),
      ...catMatches.slice(0, 2),
    ];
  } else {
    // Thin: use what we have, strict cap
    finalPeers = [
      ...subcatMatches,
      ...catMatches.slice(0, Math.max(0, maxResults - subcatMatches.length - 1)),
      ...general.slice(
        0,
        Math.max(
          0,
          2 - subcatMatches.length - catMatches.length
        )
      ),
    ];
  }
  return finalPeers.slice(0, maxResults);
}

/* ── Main handler ── */

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
      .select(
        "id, name, parent_company, company_type, category_slug, subcategory_slug, status"
      )
      .in("status", ["active", "ready"])
      .limit(800);

    if (!sourceBrands || sourceBrands.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, computed: 0, message: "No eligible brands" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Candidate pool: active only
    const candidateBrands = sourceBrands.filter(
      (b: any) => b.status === "active"
    );

    // Load all scores in batches to avoid 1000-row limit
    let allScores: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    while (true) {
      const { data: batch } = await sb
        .from("brand_scores")
        .select(
          "brand_id, score, score_labor, score_environment, score_politics, score_social"
        )
        .range(offset, offset + batchSize - 1);
      if (!batch || batch.length === 0) break;
      allScores = allScores.concat(batch);
      if (batch.length < batchSize) break;
      offset += batchSize;
    }

    const scoreMap: Record<string, any> = {};
    for (const s of allScores) scoreMap[s.brand_id] = s;

    let computed = 0;
    const errors: string[] = [];
    const targetBrands = sourceBrands.slice(
      0,
      Math.min(limit, sourceBrands.length)
    );

    let skippedNoScore = 0;
    let skippedNoPeers = 0;

    for (const brand of targetBrands) {
      try {
        const brandScore = scoreMap[brand.id];
        if (!brandScore?.score) {
          skippedNoScore++;
          continue;
        }

        // Base peers: exclude self and same-parent
        const basePeers = candidateBrands.filter((p: any) => {
          if (p.id === brand.id) return false;
          if (
            brand.parent_company &&
            p.parent_company &&
            brand.parent_company.toLowerCase() ===
              p.parent_company.toLowerCase()
          ) {
            return false;
          }
          return true;
        });

        if (basePeers.length === 0) {
          skippedNoPeers++;
          continue;
        }

        // ── BETTER OPTIONS lane ──
        // Only indie/private/nonprofit + small-public; big-brand penalty applied
        const betterCandidates = basePeers.filter((p: any) =>
          getBetterOptionClass(p.company_type || "") >= 2
        );
        const betterRanked = rankPeers(brand, betterCandidates, scoreMap, "better");
        const betterFinal = selectFinal(betterRanked, 5);

        // ── SIMILAR OPTIONS lane ──
        // Broader same-subcategory/category peers, no big-brand penalty
        const similarRanked = rankPeers(brand, basePeers, scoreMap, "similar");
        // Exclude anything already in better list
        const betterIds = new Set(betterFinal.map((p) => p.id));
        const similarFiltered = similarRanked.filter((p) => !betterIds.has(p.id));
        const similarFinal = selectFinal(similarFiltered, 5);

        // Build rows
        const altRows: any[] = [];

        for (const peer of betterFinal) {
          const ps = peer.peerScore;
          const reasons: string[] = [];
          if (ps.score > brandScore.score) reasons.push("Higher trust score");
          if (ps.score_environment > (brandScore.score_environment || 50))
            reasons.push("Better environmental record");
          if (ps.score_labor > (brandScore.score_labor || 50))
            reasons.push("Better labor practices");
          if (!peer.parent_company) reasons.push("Independent brand");

          altRows.push({
            brand_id: brand.id,
            alternative_brand_id: peer.id,
            reason:
              (reasons[0] || "Competitive trust score") +
              ` [${peer.matchReason}]`,
            score: ps.score || 50,
            alternative_type: "better",
          });
        }

        for (const peer of similarFinal) {
          altRows.push({
            brand_id: brand.id,
            alternative_brand_id: peer.id,
            reason: `Similar product [${peer.matchReason}]`,
            score: peer.peerScore?.score || 50,
            alternative_type: "similar",
          });
        }

        if (altRows.length > 0) {
          // Clear old data for this brand
          await sb
            .from("brand_alternatives")
            .delete()
            .eq("brand_id", brand.id)
            .in("alternative_type", ["precomputed", "better", "similar"]);

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
        candidatePoolSize: candidateBrands.length,
        scoresLoaded: Object.keys(scoreMap).length,
        errors: errors.slice(0, 5),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
