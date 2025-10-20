import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessingMode {
  mode: 'scheduled' | 'all' | 'backfill' | 'specific' | 'breaking';
  brandIds?: string[];
  limit?: number;
  categories?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "scheduled";
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const brandId = url.searchParams.get("brand_id");

    console.log(`[Batch Processor] Starting ${mode} mode (limit: ${limit})`);

    let brandsToProcess: any[] = [];

    // Select brands based on mode
    switch (mode) {
      case 'specific':
        if (!brandId) {
          return new Response(
            JSON.stringify({ error: "brand_id required for specific mode" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data: specificBrand } = await supabase
          .from("brands")
          .select("id, name, company_size, monitoring_config")
          .eq("id", brandId)
          .single();
        
        if (specificBrand) brandsToProcess = [specificBrand];
        break;

      case 'all':
        const { data: allBrands } = await supabase
          .from("brands")
          .select("id, name, company_size, monitoring_config")
          .eq("is_active", true)
          .order("company_size", { ascending: true })
          .limit(limit);
        
        brandsToProcess = allBrands || [];
        break;

      case 'breaking':
        // Fortune 500 companies only for breaking news
        const { data: breakingBrands } = await supabase
          .from("brands")
          .select("id, name, company_size, monitoring_config")
          .eq("is_active", true)
          .eq("company_size", "fortune_500")
          .limit(limit);
        
        brandsToProcess = breakingBrands || [];
        break;

      case 'backfill':
        // Brands with no recent events
        const { data: backfillBrands } = await supabase
          .from("brands")
          .select(`
            id, name, company_size, monitoring_config,
            brand_events!left(event_id, occurred_at)
          `)
          .eq("is_active", true)
          .limit(limit);
        
        brandsToProcess = (backfillBrands || []).filter(b => {
          const events = (b as any).brand_events || [];
          const recentEvents = events.filter((e: any) => 
            new Date(e.occurred_at) > new Date(Date.now() - 7 * 86400000)
          );
          return recentEvents.length === 0;
        });
        break;

      case 'scheduled':
      default:
        // Use fair rotation to distribute API calls across all brands
        const { data: fairBrands, error: fairError } = await supabase
          .rpc("get_next_brands_fair_rotation", { p_limit: limit });
        
        if (fairError) {
          console.error("[Batch] Fair rotation error:", fairError);
          return new Response(
            JSON.stringify({ error: fairError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        brandsToProcess = (fairBrands || []).map((b: any) => ({
          id: b.brand_id,
          name: b.brand_name,
          company_size: b.company_size
        }));
        break;
    }

    console.log(`[Batch Processor] Processing ${brandsToProcess.length} brands`);

    const results = {
      mode,
      processed: 0,
      succeeded: 0,
      failed: 0,
      details: [] as any[]
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Process each brand
    for (const brand of brandsToProcess) {
      console.log(`[Batch Processor] Processing: ${brand.name} (${brand.company_size})`);

      try {
        // Extract categories from monitoring config or use defaults
        const categories = brand.monitoring_config?.categories || ['labor', 'environment'];
        const maxArticles = brand.company_size === 'fortune_500' ? 50 : 20;

        // Call unified news orchestrator with correct params
        const response = await fetch(
          `${supabaseUrl}/functions/v1/unified-news-orchestrator?brand_id=${brand.id}&max=${maxArticles}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Orchestrator returned ${response.status}`);
        }

        const data = await response.json();
        console.log(`[Batch Processor] Orchestrator response for ${brand.name}:`, JSON.stringify(data));

        // Track API usage (estimate ~6 calls per brand for news sources)
        await supabase.rpc("increment_brand_api_usage", {
          p_brand_id: brand.id,
          p_calls: 6
        });

        // Update brand with last ingestion time
        await supabase
          .from("brands")
          .update({
            last_news_ingestion: new Date().toISOString(),
            last_ingestion_status: 'success'
          })
          .eq("id", brand.id);

        // ALWAYS calculate score after ingestion (even if 0 new events, for baseline refresh)
        console.log(`[Batch Processor] Triggering score calculation for ${brand.name}...`);
        try {
          const scoreResponse = await fetch(
            `${supabaseUrl}/functions/v1/calculate-brand-score`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                brand_id: brand.id,
                persist: true
              })
            }
          );

          if (scoreResponse.ok) {
            const scoreData = await scoreResponse.json();
            console.log(`[Batch Processor] Score calculated for ${brand.name}:`, {
              labor: scoreData.final?.score_labor,
              environment: scoreData.final?.score_environment,
              politics: scoreData.final?.score_politics,
              social: scoreData.final?.score_social
            });
          } else {
            const errorText = await scoreResponse.text();
            console.error(`[Batch Processor] Score calculation failed for ${brand.name} (${scoreResponse.status}):`, errorText);
          }
        } catch (scoreError) {
          console.error(`[Batch Processor] Score calculation error for ${brand.name}:`, scoreError);
        }

        results.succeeded++;
        results.details.push({
          brand: brand.name,
          status: 'success',
          inserted: data.totalInserted,
          corroborated: data.totalCorroborated
        });

      } catch (error) {
        console.error(`[Batch Processor] Failed for ${brand.name}:`, error);

        // Update brand with failure status
        await supabase
          .from("brands")
          .update({
            last_ingestion_status: 'failed'
          })
          .eq("id", brand.id);

        results.failed++;
        results.details.push({
          brand: brand.name,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }

      results.processed++;

      // Rate limiting between brands (avoid overwhelming system)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`[Batch Processor] Complete - ${results.succeeded} succeeded, ${results.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        ...results
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Batch Processor] Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
