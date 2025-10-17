// Historical baseline scanner: Establishes "normal" metrics for a brand
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[BaselineScanner] Starting historical baseline scan");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand_id");

  try {
    // Get brand to scan
    let brands: any[] = [];
    if (brandId) {
      const { data } = await supabase
        .from("brands")
        .select("id,name")
        .eq("id", brandId)
        .single();
      if (data) brands = [data];
    } else {
      // Scan brands without baselines
      const { data } = await supabase
        .from("brands")
        .select("id,name")
        .eq("is_active", true)
        .not("id", "in", supabase.from("brand_baselines").select("brand_id"))
        .limit(10);
      brands = data ?? [];
    }

    if (brands.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No brands need baseline scans" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[BaselineScanner] Scanning ${brands.length} brands`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    for (const brand of brands) {
      console.log(`[BaselineScanner] Processing ${brand.name}`);

      // Mark scan started
      await supabase.from("brand_baselines").upsert({
        brand_id: brand.id,
        scan_started_at: new Date().toISOString(),
        baseline_complete: false
      }, { onConflict: "brand_id" });

      // 1. FIRST: Backfill 90 days of historical news data
      console.log(`[BaselineScanner] Fetching 90 days of news for ${brand.name}`);
      
      const orchestratorUrl = `${supabaseUrl}/functions/v1/unified-news-orchestrator?brand_id=${brand.id}&days_back=90&max=50`;
      const orchestratorResponse = await fetch(orchestratorUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json"
        }
      });

      if (!orchestratorResponse.ok) {
        console.error(`[BaselineScanner] Failed to fetch historical data for ${brand.name}`);
        continue;
      }

      const orchestratorResult = await orchestratorResponse.json();
      console.log(`[BaselineScanner] Orchestrator inserted ${orchestratorResult.totalInserted} articles for ${brand.name}`);

      // 2. NOW: Fetch the historical events we just inserted
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: events } = await supabase
        .from("brand_events")
        .select("event_id, category, event_date, created_at")
        .eq("brand_id", brand.id)
        .gte("event_date", ninetyDaysAgo.toISOString())
        .order("event_date", { ascending: false });

      if (!events || events.length === 0) {
        // Still no data after ingestion - set neutral baseline
        await supabase.from("brand_baselines").upsert({
          brand_id: brand.id,
          articles_per_week: 0,
          median_sentiment: 0,
          articles_analyzed: 0,
          baseline_complete: true,
          scan_completed_at: new Date().toISOString()
        }, { onConflict: "brand_id" });
        console.log(`[BaselineScanner] ${brand.name}: No historical data found after ingestion, neutral baseline set`);
        continue;
      }

      // 2. Calculate metrics
      const weeks = 13; // 90 days / 7
      const articlesPerWeek = events.length / weeks;

      // Category distribution
      const categoryCount: Record<string, number> = {};
      events.forEach(e => {
        const cat = e.category ?? "general";
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });

      const laborFreq = (categoryCount["labor"] || 0) / events.length;
      const envFreq = (categoryCount["environment"] || 0) / events.length;
      const polFreq = (categoryCount["politics"] || 0) / events.length;
      const socialFreq = (categoryCount["social"] || 0) / events.length;

      // Common categories (top 3)
      const sortedCategories = Object.entries(categoryCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat);

      // 3. Fetch source diversity
      const { data: sources } = await supabase
        .from("event_sources")
        .select("registrable_domain, event_id")
        .in("event_id", events.map(e => e.event_id));

      const uniqueDomains = new Set(sources?.map(s => s.registrable_domain) || []).size;
      const avgSourcesPerArticle = (sources?.length || 0) / events.length;

      // 4. Calculate baseline scores (inverse of frequency - fewer issues = higher score)
      // More frequent issues in a category = lower baseline score
      const calcBaselineScore = (freq: number) => {
        // freq 0 = 75 (rarely mentioned), freq 0.5 = 50, freq 1 = 25 (always mentioned)
        return Math.max(25, Math.min(75, Math.round(75 - (freq * 50))));
      };

      const baselineLabor = calcBaselineScore(laborFreq);
      const baselineEnvironment = calcBaselineScore(envFreq);
      const baselinePolitics = calcBaselineScore(polFreq);
      const baselineSocial = calcBaselineScore(socialFreq);

      // 5. Store baseline
      await supabase.from("brand_baselines").upsert({
        brand_id: brand.id,
        articles_per_week: articlesPerWeek,
        median_sentiment: 0, // TODO: sentiment analysis
        common_categories: sortedCategories,
        labor_frequency: laborFreq,
        environment_frequency: envFreq,
        politics_frequency: polFreq,
        social_frequency: socialFreq,
        avg_sources_per_article: avgSourcesPerArticle,
        unique_domains: uniqueDomains,
        baseline_labor: baselineLabor,
        baseline_environment: baselineEnvironment,
        baseline_politics: baselinePolitics,
        baseline_social: baselineSocial,
        articles_analyzed: events.length,
        baseline_complete: true,
        scan_completed_at: new Date().toISOString()
      }, { onConflict: "brand_id" });

      console.log(`[BaselineScanner] ${brand.name}: Baseline complete - ${events.length} articles analyzed`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        brands_scanned: brands.length,
        message: "Baseline scan complete"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[BaselineScanner] Error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
