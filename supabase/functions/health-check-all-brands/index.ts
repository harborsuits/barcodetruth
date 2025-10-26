import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * System-wide health check that finds and heals incomplete brands
 * Runs daily via cron to maintain database health
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[Maintenance] 🔍 Starting system-wide health check");

    // Find brands that need healing
    const { data: incompleteBrands, error: queryError } = await supabase
      .rpc('get_incomplete_brands' as any);

    if (queryError) {
      console.error("[Maintenance] Error fetching incomplete brands:", queryError);
      throw queryError;
    }

    const brands = incompleteBrands || [];
    console.log(`[Maintenance] Found ${brands.length} incomplete brands`);

    if (brands.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          healed: 0,
          message: "All brands are complete" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const brand of brands) {
      try {
        console.log(`[Maintenance] 🔧 Healing: ${brand.name}`);

        // Trigger full enrichment for each incomplete brand
        const { error: enrichError } = await supabase.functions.invoke('enrich-brand-wiki', {
          body: { 
            brand_id: brand.id,
            wikidata_qid: brand.wikidata_qid,
            mode: 'full' 
          }
        });

        if (enrichError) {
          console.error(`[Maintenance] Failed to heal ${brand.name}:`, enrichError);
          results.push({ brand: brand.name, success: false, error: enrichError.message });
        } else {
          console.log(`[Maintenance] ✓ Healed: ${brand.name}`);
          results.push({ brand: brand.name, success: true });
        }

        // Rate limit to avoid overwhelming external APIs
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`[Maintenance] Exception healing ${brand.name}:`, error);
        results.push({ brand: brand.name, success: false, error: error.message });
      }
    }

    const successful = results.filter(r => r.success).length;
    console.log(`[Maintenance] ✅ Complete: ${successful}/${brands.length} brands healed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: brands.length,
        healed: successful,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Maintenance] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
