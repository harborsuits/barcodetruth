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

      // Get events from last 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: events, error: eventsError } = await supabase
        .from("brand_events")
        .select("orientation, verification, category")
        .eq("brand_id", brand.id)
        .gte("event_date", ninetyDaysAgo);

      if (eventsError) {
        console.error(`[simple-brand-scorer] Error fetching events for ${brand.name}:`, eventsError);
        continue;
      }

      let score = 50; // Start neutral
      let breakdown = {
        total_events: events?.length || 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        verified_negative: 0,
      };

      if (events && events.length > 0) {
        // Count event types (enum is 'positive', 'negative', 'mixed')
        breakdown.positive = events.filter(e => e.orientation === 'positive').length;
        breakdown.negative = events.filter(e => e.orientation === 'negative').length;
        breakdown.neutral = events.filter(e => e.orientation === 'mixed' || !e.orientation).length;
        breakdown.verified_negative = events.filter(e => 
          e.orientation === 'negative' && e.verification === 'official'
        ).length;

        const totalOriented = breakdown.positive + breakdown.negative;

        if (totalOriented > 0) {
          // Calculate score based on positive/negative ratio
          const ratio = (breakdown.positive - breakdown.negative) / totalOriented;
          score = 50 + (ratio * 30); // Range: 20-80 based on ratio
        }

        // Apply penalties for verified negative events (official sources)
        score -= (breakdown.verified_negative * 3);

        // Extra penalty for labor and environment violations
        const criticalViolations = events.filter(e => 
          e.orientation === 'negative' && 
          (e.category === 'labor' || e.category === 'environment') &&
          e.verification === 'official'
        ).length;
        score -= (criticalViolations * 2);

        // Keep in reasonable range
        score = Math.max(10, Math.min(90, Math.round(score)));
      }

      // Calculate category scores (simplified)
      const laborScore = 50 - (events?.filter(e => e.category === 'labor' && e.orientation === 'negative').length * 5);
      const envScore = 50 - (events?.filter(e => e.category === 'environment' && e.orientation === 'negative').length * 5);
      const politicsScore = 50 - (events?.filter(e => e.category === 'politics' && e.orientation === 'negative').length * 3);
      const socialScore = 50 - (events?.filter(e => e.category === 'social' && e.orientation === 'negative').length * 4);

      // Save score
      const { error: upsertError } = await supabase
        .from("brand_scores")
        .upsert({
          brand_id: brand.id,
          score: score,
          score_labor: Math.max(10, Math.min(90, laborScore)),
          score_environment: Math.max(10, Math.min(90, envScore)),
          score_politics: Math.max(10, Math.min(90, politicsScore)),
          score_social: Math.max(10, Math.min(90, socialScore)),
          breakdown: breakdown,
          last_updated: new Date().toISOString(),
        }, { onConflict: 'brand_id' });

      if (upsertError) {
        console.error(`[simple-brand-scorer] Error saving score for ${brand.name}:`, upsertError);
        results.push({ brand: brand.name, success: false, error: upsertError.message });
      } else {
        console.log(`[simple-brand-scorer] ${brand.name}: score=${score}, breakdown:`, breakdown);
        results.push({ brand: brand.name, success: true, score, breakdown });
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

