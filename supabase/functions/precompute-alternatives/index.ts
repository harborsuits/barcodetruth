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

function getBetterOptionClass(companyType: string): number {
  const ct = (companyType || "").toLowerCase();
  if (["independent", "local", "cooperative", "nonprofit", "private"].includes(ct)) return 3;
  return 1;
}

function getBigBrandPenalty(companyType: string, lane: "better" | "similar"): number {
  if (lane === "similar") return 0;
  const ct = (companyType || "").toLowerCase();
  if (ct === "subsidiary" || ct === "conglomerate") return -12;
  if (ct === "public") return -4;
  return 0;
}

/* ── Subcategory fallback matching ── */

/**
 * Check if a peer is an allowed match for a brand using strict subcategory gating.
 * Returns match tier: 'exact_subcategory' | 'fallback_subcategory' | 'no_match'
 */
function getSubcategoryMatch(
  brandSubcategory: string | null,
  peerSubcategory: string | null,
  fallbackMap: Record<string, Set<string>>
): "exact_subcategory" | "fallback_subcategory" | "no_match" {
  if (!brandSubcategory || !peerSubcategory) return "no_match";
  if (brandSubcategory === peerSubcategory) return "exact_subcategory";
  const allowed = fallbackMap[brandSubcategory];
  if (allowed && allowed.has(peerSubcategory)) return "fallback_subcategory";
  return "no_match";
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
  matchTier: "exact_subcategory" | "fallback_subcategory" | "category_only";
  matchReason: string;
  betterOptionClass: number;
  rankScore: number;
}

function rankPeers(
  brand: any,
  peers: any[],
  scoreMap: Record<string, any>,
  lane: "better" | "similar",
  fallbackMap: Record<string, Set<string>>
): RankedPeer[] {
  return peers
    .map((p) => {
      const ps = scoreMap[p.id];
      if (!ps?.score) return null;

      const independenceBonus = getIndependenceBonus(p.company_type || "");
      const bigBrandPenalty = getBigBrandPenalty(p.company_type || "", lane);
      const betterOptionClass = getBetterOptionClass(p.company_type || "");

      // Strict subcategory gating
      const subcatMatch = getSubcategoryMatch(
        brand.subcategory_slug,
        p.subcategory_slug,
        fallbackMap
      );

      // If brand has a subcategory, only allow exact or fallback matches
      // Category-only matches are only used when brand has NO subcategory
      if (brand.subcategory_slug && subcatMatch === "no_match") {
        // Check if at least same category for loose fallback (capped)
        const sameCat =
          brand.category_slug && p.category_slug &&
          brand.category_slug === p.category_slug;
        if (!sameCat) return null; // completely unrelated, skip

        // Same category but wrong subcategory — mark as category_only
        // These get a heavy penalty and are only used if nothing better exists
        return {
          ...p,
          peerScore: ps,
          matchTier: "category_only" as const,
          matchReason: "category_fallback_weak",
          betterOptionClass,
          rankScore:
            (ps.score || 50) + independenceBonus + bigBrandPenalty - 15, // heavy penalty
        } as RankedPeer;
      }

      let tierBonus = 0;
      let matchReason = "";
      if (subcatMatch === "exact_subcategory") {
        tierBonus = 25;
        matchReason = "matched_subcategory";
      } else if (subcatMatch === "fallback_subcategory") {
        tierBonus = 15;
        matchReason = "matched_fallback_subcategory";
      } else {
        // Brand has no subcategory — use category match
        const sameCat =
          brand.category_slug && p.category_slug &&
          brand.category_slug === p.category_slug;
        if (sameCat) {
          tierBonus = 10;
          matchReason = "matched_category";
        } else {
          matchReason = "general_independent";
        }
      }

      return {
        ...p,
        peerScore: ps,
        matchTier: subcatMatch === "no_match" ? "category_only" : subcatMatch,
        matchReason,
        betterOptionClass,
        rankScore:
          (ps.score || 50) + independenceBonus + tierBonus + bigBrandPenalty,
      } as RankedPeer;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      // Primary: exact subcategory > fallback > category_only
      const tierOrder = { exact_subcategory: 3, fallback_subcategory: 2, category_only: 1 };
      const aTier = tierOrder[a.matchTier as keyof typeof tierOrder] || 0;
      const bTier = tierOrder[b.matchTier as keyof typeof tierOrder] || 0;
      if (aTier !== bTier) return bTier - aTier;
      // Secondary (better lane): betterOptionClass
      if (lane === "better" && a.betterOptionClass !== b.betterOptionClass)
        return b.betterOptionClass - a.betterOptionClass;
      // Tertiary: rankScore
      return b.rankScore - a.rankScore;
    }) as RankedPeer[];
}

/** "Fewer but cleaner" — prefer exact/fallback, limit category_only leakage */
function selectFinal(ranked: RankedPeer[], maxResults: number): RankedPeer[] {
  const exact = ranked.filter((p) => p.matchTier === "exact_subcategory");
  const fallback = ranked.filter((p) => p.matchTier === "fallback_subcategory");
  const weak = ranked.filter((p) => p.matchTier === "category_only");

  const strong = [...exact, ...fallback];

  // Never pad with weak category-only matches — show fewer but cleaner
  return strong.slice(0, maxResults);
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

    const { limit = 500 } = await req.json().catch(() => ({}));

    // Load fallback map
    const { data: fallbackRows } = await sb
      .from("subcategory_fallbacks")
      .select("source_subcategory, allowed_fallback_subcategory");

    const fallbackMap: Record<string, Set<string>> = {};
    for (const row of fallbackRows || []) {
      if (!fallbackMap[row.source_subcategory]) {
        fallbackMap[row.source_subcategory] = new Set();
      }
      fallbackMap[row.source_subcategory].add(row.allowed_fallback_subcategory);
    }

    // Source brands: ready + active (batched to avoid 1000-row limit)
    let sourceBrands: any[] = [];
    let brandOffset = 0;
    const brandBatchSize = 1000;
    while (true) {
      const { data: batch } = await sb
        .from("brands")
        .select(
          "id, name, parent_company, company_type, category_slug, subcategory_slug, status"
        )
        .in("status", ["active", "ready"])
        .range(brandOffset, brandOffset + brandBatchSize - 1);
      if (!batch || batch.length === 0) break;
      sourceBrands = sourceBrands.concat(batch);
      if (batch.length < brandBatchSize) break;
      brandOffset += brandBatchSize;
    }

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

    // Load all scores in batches
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
    const targetBrands = sourceBrands.slice(0, Math.min(limit, sourceBrands.length));

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
        const betterCandidates = basePeers.filter((p: any) =>
          getBetterOptionClass(p.company_type || "") >= 3
        );
        const betterRanked = rankPeers(brand, betterCandidates, scoreMap, "better", fallbackMap);
        const betterFinal = selectFinal(betterRanked, 5);

        // ── SIMILAR OPTIONS lane ──
        const similarRanked = rankPeers(brand, basePeers, scoreMap, "similar", fallbackMap);
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
        fallbackMappings: Object.keys(fallbackMap).length,
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
