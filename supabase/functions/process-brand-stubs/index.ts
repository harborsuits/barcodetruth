import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const BATCH_SIZE = 5; // Process 5 brands per run to avoid timeouts
const MAX_ATTEMPTS = 5; // Max retry attempts before giving up

// Exponential backoff schedule (in minutes)
const BACKOFF_SCHEDULE = [5, 15, 60, 360, 1440]; // 5m, 15m, 1h, 6h, 24h

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate CRON_SECRET for scheduled invocations (security)
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  
  // Only enforce if CRON_SECRET is configured
  if (expectedSecret && cronSecret !== expectedSecret) {
    console.log("[process-brand-stubs] Unauthorized: invalid or missing X-Cron-Secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
    claimed: 0,
    errors: [] as string[],
  };

  try {
    // Claim brands that need processing with lease pattern:
    // - status is stub or failed
    // - next_enrichment_at <= now (ready for processing)
    // - enrichment_attempts < MAX_ATTEMPTS (not exhausted)
    const { data: brandsToProcess, error: fetchError } = await supabase
      .from("brands")
      .select("id, name, status, wikidata_qid, enrichment_attempts, created_at")
      .or("status.eq.stub,status.eq.failed")
      .lt("enrichment_attempts", MAX_ATTEMPTS)
      .lte("next_enrichment_at", new Date().toISOString())
      .order("next_enrichment_at", { ascending: true }) // Oldest scheduled first
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw new Error(`Failed to fetch brands: ${fetchError.message}`);
    }

    if (!brandsToProcess || brandsToProcess.length === 0) {
      console.log("[process-brand-stubs] No brands ready for processing");
      return new Response(JSON.stringify({ 
        message: "No brands ready for processing",
        ...results 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    results.claimed = brandsToProcess.length;
    console.log(`[process-brand-stubs] Claimed ${brandsToProcess.length} brands for processing`);

    // Mark all claimed brands as "building" with stage tracking to prevent double-processing
    const brandIds = brandsToProcess.map(b => b.id);
    const now = new Date().toISOString();
    await supabase
      .from("brands")
      .update({ 
        status: "building",
        enrichment_started_at: now,
        enrichment_stage: "started",
        enrichment_stage_updated_at: now,
        updated_at: now
      })
      .in("id", brandIds);

    // Process each brand
    for (const brand of brandsToProcess) {
      results.processed++;
      const currentAttempts = (brand.enrichment_attempts ?? 0) + 1;
      
      try {
        console.log(`[process-brand-stubs] Processing brand: ${brand.name} (${brand.id}), attempt ${currentAttempts}`);
        
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

        // Success: reset attempts and mark ready with done stage
        const successNow = new Date().toISOString();
        await supabase
          .from("brands")
          .update({ 
            status: "ready",
            enrichment_stage: "done",
            enrichment_stage_updated_at: successNow,
            enrichment_attempts: 0,
            enrichment_error: null,
            next_enrichment_at: null,
            updated_at: successNow
          })
          .eq("id", brand.id);

        console.log(`[process-brand-stubs] ✓ Successfully enriched: ${brand.name}`);
        results.succeeded++;
        
      } catch (brandError: unknown) {
        const errorMessage = brandError instanceof Error ? brandError.message : String(brandError);
        console.error(`[process-brand-stubs] ✗ Failed to process ${brand.name}: ${errorMessage}`);
        results.failed++;
        results.errors.push(`${brand.name}: ${errorMessage}`);
        
        // Calculate next retry time with exponential backoff
        const backoffMinutes = BACKOFF_SCHEDULE[Math.min(currentAttempts - 1, BACKOFF_SCHEDULE.length - 1)];
        const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
        
        // Update brand with error, failed stage, and schedule retry
        const failNow = new Date().toISOString();
        await supabase
          .from("brands")
          .update({ 
            status: currentAttempts >= MAX_ATTEMPTS ? "failed" : "stub",
            enrichment_stage: "failed",
            enrichment_stage_updated_at: failNow,
            enrichment_attempts: currentAttempts,
            enrichment_error: errorMessage.slice(0, 500),
            next_enrichment_at: nextRetryAt.toISOString(),
            updated_at: failNow
          })
          .eq("id", brand.id);
        
        console.log(`[process-brand-stubs] Scheduled retry for ${brand.name} at ${nextRetryAt.toISOString()} (attempt ${currentAttempts}/${MAX_ATTEMPTS})`);
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
