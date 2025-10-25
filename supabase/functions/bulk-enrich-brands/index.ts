import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[bulk-enrich-brands] Starting bulk enrichment...");

    // Get all brands without Wikipedia descriptions
    const { data: brands, error: brandsErr } = await supabase
      .from("brands")
      .select("id, name, wikidata_qid")
      .or('description.is.null,description_source.neq.wikipedia')
      .limit(100);

    if (brandsErr) throw brandsErr;

    if (!brands || brands.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, note: "All brands already enriched" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[bulk-enrich-brands] Processing ${brands.length} brands`);

    const results: Array<{ brand_id: string; name: string; success: boolean; error?: string }> = [];

    for (const brand of brands) {
      try {
        // Step 1: Check if brand needs enrichment (ownership + people + shareholders)
        const { data: ownership } = await supabase
          .from("company_ownership")
          .select("id")
          .eq("child_brand_id", brand.id)
          .limit(1);

        const hasOwnership = ownership && ownership.length > 0;

        if (hasOwnership) {
          console.log(`[bulk-enrich-brands] ${brand.name}: Already has complete data, skipping`);
          results.push({ brand_id: brand.id, name: brand.name, success: true, error: "Already enriched" });
          continue;
        }

        console.log(`[bulk-enrich-brands] ${brand.name}: Missing ownership data, enriching...`);

        // Step 2: Create corporate structure first (use existing QID if available)
        const treeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/resolve-wikidata-tree`;
        const treeResponse = await fetch(treeUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            brand_name: brand.name,
            qid: brand.wikidata_qid // CRITICAL: Pass existing QID to avoid wrong entity matches
          }),
        });

        if (!treeResponse.ok) {
          const text = await treeResponse.text();
          console.warn(`[bulk-enrich-brands] ${brand.name}: Tree resolution failed: ${text}`);
        } else {
          console.log(`[bulk-enrich-brands] ${brand.name}: Corporate structure created`);
        }

        // Step 3: Enrich with full data (people + shareholders)
        const enrichUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-brand-wiki`;
        const enrichResponse = await fetch(enrichUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ brand_id: brand.id, mode: "full" }),
        });

        if (!enrichResponse.ok) {
          const text = await enrichResponse.text();
          throw new Error(`HTTP ${enrichResponse.status}: ${text}`);
        }

        const data = await enrichResponse.json();
        console.log(`[bulk-enrich-brands] ${brand.name}: Full enrichment ${data.success ? 'complete' : 'failed'}`);

        results.push({ brand_id: brand.id, name: brand.name, success: true });

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`[bulk-enrich-brands] Error for ${brand.name}:`, error);
        results.push({ brand_id: brand.id, name: brand.name, success: false, error: error.message });
      }
    }

    const successful = results.filter((r) => r.success).length;

    console.log(`[bulk-enrich-brands] Complete: ${successful}/${results.length} succeeded`);

    return new Response(
      JSON.stringify({ success: true, total: results.length, successful, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[bulk-enrich-brands] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
