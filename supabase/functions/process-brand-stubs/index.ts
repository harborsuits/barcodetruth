import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 5; // Process 5 brands per run to avoid timeouts
const MAX_RETRIES = 3; // Max retry attempts for failed brands

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const startTime = Date.now();
  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // Find brands that need processing: stubs or failed with retries remaining
    const { data: brandsToProcess, error: fetchError } = await supabase
      .from("brands")
      .select("id, name, status, wikidata_qid, created_at")
      .or("status.eq.stub,status.eq.failed")
      .order("created_at", { ascending: true }) // Oldest first
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw new Error(`Failed to fetch brands: ${fetchError.message}`);
    }

    if (!brandsToProcess || brandsToProcess.length === 0) {
      console.log("[process-brand-stubs] No brands to process");
      return new Response(JSON.stringify({ 
        message: "No brands to process",
        ...results 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[process-brand-stubs] Found ${brandsToProcess.length} brands to process`);

    // Process each brand
    for (const brand of brandsToProcess) {
      results.processed++;
      
      try {
        console.log(`[process-brand-stubs] Processing brand: ${brand.name} (${brand.id})`);
        
        // Call enrich-brand-wiki for this brand
        const { data: enrichResult, error: enrichError } = await supabase.functions.invoke(
          "enrich-brand-wiki",
          {
            body: { 
              brand_id: brand.id,
              wikidata_qid: brand.wikidata_qid,
              mode: "full" // Full enrichment including ownership
            },
          }
        );

        if (enrichError) {
          throw new Error(enrichError.message || "Enrichment function failed");
        }

        if (enrichResult?.error) {
          throw new Error(enrichResult.error);
        }

        console.log(`[process-brand-stubs] Successfully enriched: ${brand.name}`);
        results.succeeded++;
        
      } catch (brandError: unknown) {
        const errorMessage = brandError instanceof Error ? brandError.message : String(brandError);
        console.error(`[process-brand-stubs] Failed to process ${brand.name}: ${errorMessage}`);
        results.failed++;
        results.errors.push(`${brand.name}: ${errorMessage}`);
        
        // Update brand with error (enrich-brand-wiki should handle this, but as backup)
        await supabase
          .from("brands")
          .update({ 
            status: "failed",
            last_build_error: errorMessage.slice(0, 500),
            updated_at: new Date().toISOString()
          })
          .eq("id", brand.id);
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(JSON.stringify({
      level: "info",
      fn: "process-brand-stubs",
      ...results,
      duration_ms: duration,
    }));

    return new Response(JSON.stringify({
      message: "Brand stub processing complete",
      ...results,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[process-brand-stubs] Fatal error: ${errorMessage}`);
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      ...results 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
