import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[simple-brand-scorer] Starting scoring process...");

    // Get all active brands
    const { data: brands, error: brandsError } = await supabase
      .from("brands")
      .select("id, name")
      .eq("is_active", true);

    if (brandsError) throw brandsError;

    const results = [];

    for (const brand of brands || []) {
      console.log(`[simple-brand-scorer] Processing: ${brand.name}`);

      // Call the new SQL RPC function to compute scores from impact fields
      const { data: scoreData, error: scoreError } = await supabase
        .rpc('compute_brand_score', { p_brand: brand.id });

      if (scoreError) {
        console.error(`[simple-brand-scorer] Error computing score for ${brand.name}:`, scoreError);
        results.push({ brand: brand.name, success: false, error: scoreError.message });
        continue;
      }

      const scores = scoreData?.[0];
      if (!scores) {
        console.log(`[simple-brand-scorer] No score data for ${brand.name} - using defaults`);
        results.push({ 
          brand: brand.name, 
          success: true, 
          score: 50, 
          breakdown: { note: "No recent events" } 
        });
        continue;
      }

      // Get event breakdown for display
      const { data: events } = await supabase
        .from("brand_events")
        .select("orientation, category")
        .eq("brand_id", brand.id)
        .gte("event_date", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

      const breakdown = {
        total_events: events?.length || 0,
        positive: events?.filter(e => e.orientation === 'positive').length || 0,
        negative: events?.filter(e => e.orientation === 'negative').length || 0,
        mixed: events?.filter(e => e.orientation === 'mixed').length || 0,
        by_category: {
          labor: events?.filter(e => e.category === 'labor').length || 0,
          environment: events?.filter(e => e.category === 'environment').length || 0,
          politics: events?.filter(e => e.category === 'politics').length || 0,
          social: events?.filter(e => e.category === 'social').length || 0,
        }
      };

      // Save score
      const { error: upsertError } = await supabase
        .from("brand_scores")
        .upsert({
          brand_id: brand.id,
          score: Math.round(Number(scores.score)),
          score_labor: Math.round(Number(scores.score_labor)),
          score_environment: Math.round(Number(scores.score_environment)),
          score_politics: Math.round(Number(scores.score_politics)),
          score_social: Math.round(Number(scores.score_social)),
          breakdown: breakdown,
          last_updated: new Date().toISOString(),
        }, { onConflict: 'brand_id' });

      if (upsertError) {
        console.error(`[simple-brand-scorer] Error saving score for ${brand.name}:`, upsertError);
        results.push({ brand: brand.name, success: false, error: upsertError.message });
      } else {
        const finalScore = Math.round(Number(scores.score));
        console.log(`[simple-brand-scorer] ${brand.name}: score=${finalScore}, breakdown:`, breakdown);
        results.push({ brand: brand.name, success: true, score: finalScore, breakdown });
      }
    }

    const summary = {
      success: true,
      processed: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };

    console.log("[simple-brand-scorer] Complete:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[simple-brand-scorer] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

