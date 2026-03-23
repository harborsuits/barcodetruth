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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { limit = 30 } = await req.json().catch(() => ({}));

    // Get top brands by scan count + high traffic brands
    const { data: topBrands } = await sb
      .from("user_scans")
      .select("brand_id")
      .not("brand_id", "is", null)
      .order("scanned_at", { ascending: false })
      .limit(500);

    // Count scan frequency per brand
    const brandCounts: Record<string, number> = {};
    for (const s of topBrands || []) {
      if (s.brand_id) {
        brandCounts[s.brand_id] = (brandCounts[s.brand_id] || 0) + 1;
      }
    }

    // Sort by frequency and take top N
    const topBrandIds = Object.entries(brandCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.min(limit, 50))
      .map(([id]) => id);

    if (topBrandIds.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, computed: 0, message: "No scanned brands found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let computed = 0;
    const errors: string[] = [];

    for (const brandId of topBrandIds) {
      try {
        // Get the brand's category
        const { data: brand } = await sb
          .from("brands")
          .select("id, name, category_slug")
          .eq("id", brandId)
          .single();

        if (!brand?.category_slug) continue;

        // Find category peers with scores
        const { data: peers } = await sb
          .from("brands")
          .select("id, name, category_slug")
          .eq("category_slug", brand.category_slug)
          .eq("is_active", true)
          .neq("id", brandId)
          .limit(50);

        if (!peers || peers.length === 0) continue;

        const peerIds = peers.map((p: any) => p.id);

        // Get scores for peers
        const { data: peerScores } = await sb
          .from("brand_scores")
          .select("brand_id, composite_score, score_labor, score_environment, score_politics, score_social")
          .in("brand_id", peerIds);

        if (!peerScores || peerScores.length === 0) continue;

        // Get brand's own score
        const { data: brandScore } = await sb
          .from("brand_scores")
          .select("composite_score, score_labor, score_environment, score_politics, score_social")
          .eq("brand_id", brandId)
          .single();

        // Rank peers by composite score (higher is better alternative)
        const rankedPeers = peerScores
          .filter((p: any) => p.composite_score != null)
          .sort((a: any, b: any) => (b.composite_score || 0) - (a.composite_score || 0))
          .slice(0, 10);

        // Upsert alternatives
        const altRows = rankedPeers.map((peer: any, idx: number) => {
          const reasons: string[] = [];
          if (peer.score_environment > (brandScore?.score_environment || 50))
            reasons.push("Better environmental record");
          if (peer.score_labor > (brandScore?.score_labor || 50))
            reasons.push("Better labor practices");
          if (peer.composite_score > (brandScore?.composite_score || 50))
            reasons.push("Higher overall score");

          return {
            brand_id: brandId,
            alternative_brand_id: peer.brand_id,
            reason: reasons.length > 0 ? reasons[0] : "Category peer with competitive score",
            score: peer.composite_score || 50,
            alternative_type: "precomputed",
          };
        });

        if (altRows.length > 0) {
          // Remove old precomputed alternatives for this brand
          await sb
            .from("brand_alternatives")
            .delete()
            .eq("brand_id", brandId)
            .eq("alternative_type", "precomputed");

          // Insert new ones
          const { error } = await sb.from("brand_alternatives").insert(altRows);
          if (error) {
            errors.push(`${brand.name}: ${error.message}`);
          } else {
            computed++;
          }
        }
      } catch (e: any) {
        errors.push(`${brandId}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        computed,
        total_candidates: topBrandIds.length,
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
