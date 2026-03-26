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

    // Get ALL active brands with their scores
    const { data: activeBrands } = await sb
      .from("brands")
      .select("id, name, parent_company, company_type, category_slug")
      .eq("status", "active")
      .limit(500);

    if (!activeBrands || activeBrands.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, computed: 0, message: "No active brands" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const brandIds = activeBrands.map((b: any) => b.id);

    // Get all scores in one query
    const { data: allScores } = await sb
      .from("brand_scores")
      .select("brand_id, score, score_labor, score_environment, score_politics, score_social")
      .in("brand_id", brandIds);

    const scoreMap: Record<string, any> = {};
    for (const s of allScores || []) {
      scoreMap[s.brand_id] = s;
    }

    const brandMap: Record<string, any> = {};
    for (const b of activeBrands) {
      brandMap[b.id] = b;
    }

    let computed = 0;
    const errors: string[] = [];
    const targetBrands = activeBrands.slice(0, Math.min(limit, activeBrands.length));

    for (const brand of targetBrands) {
      try {
        const brandScore = scoreMap[brand.id];
        if (!brandScore?.score) continue;

        // Find peers: all active brands EXCEPT same parent company
        const peers = activeBrands.filter((p: any) => {
          if (p.id === brand.id) return false;
          // Exclude brands with same parent company (no conglomerate self-substitution)
          if (brand.parent_company && p.parent_company &&
              brand.parent_company.toLowerCase() === p.parent_company.toLowerCase()) {
            return false;
          }
          // Must have a score
          if (!scoreMap[p.id]?.score) return false;
          return true;
        });

        if (peers.length === 0) continue;

        // Rank peers: higher score = better alternative
        // Bonus for independence (non-conglomerate, smaller companies)
        const rankedPeers = peers
          .map((p: any) => {
            const ps = scoreMap[p.id];
            let independenceBonus = 0;
            const ct = (p.company_type || "").toLowerCase();
            if (ct === "independent" || ct === "local" || ct === "cooperative") independenceBonus = 8;
            else if (ct === "nonprofit") independenceBonus = 7;
            else if (ct === "private") independenceBonus = 4;
            else if (ct === "public") independenceBonus = 2;

            return {
              ...p,
              peerScore: ps,
              rankScore: (ps.score || 50) + independenceBonus,
            };
          })
          .sort((a: any, b: any) => b.rankScore - a.rankScore)
          .slice(0, 8);

        const altRows = rankedPeers.map((peer: any) => {
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

          return {
            brand_id: brand.id,
            alternative_brand_id: peer.id,
            reason: reasons.length > 0 ? reasons[0] : "Competitive trust score",
            score: ps.score || 50,
            alternative_type: "precomputed",
          };
        });

        if (altRows.length > 0) {
          // Remove old precomputed alternatives
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
