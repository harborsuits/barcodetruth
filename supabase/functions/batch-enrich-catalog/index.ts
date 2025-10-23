import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Exponential backoff with jitter for rate limit handling
async function withBackoff<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let delay = 400; // ms
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const status = e?.status || e?.response?.status;
      if (![429, 500, 502, 503, 504].includes(status) || i === tries - 1) {
        throw e;
      }
      await new Promise(r => setTimeout(r, delay + Math.random() * 200));
      delay *= 1.8;
    }
  }
  throw new Error('unreachable');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const lockName = 'batch-enrich-catalog';
  let lockAcquired = false;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { limit = 50, dry_run = false } = await req.json().catch(() => ({}));

    // 1) Acquire lock
    const { data: gotLock, error: lockErr } = await supabase
      .from('enrichment_job_locks')
      .insert({ lock_name: lockName, owner: 'edge:batch-enrich-catalog' })
      .select()
      .single();

    if (lockErr && lockErr.code !== '23505') {
      throw lockErr;
    }
    if (lockErr?.code === '23505') {
      return new Response(JSON.stringify({
        message: 'Another enrichment job is currently running. Please wait and try again.'
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    lockAcquired = true;

    // 2) Get brands needing enrichment
    const { data: brands, error: fetchError } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid')
      .not('wikidata_qid', 'is', null)
      .eq('is_active', true)
      .eq('is_test', false)
      .order('name')
      .limit(limit);

    if (fetchError) throw fetchError;

    console.log(`[Batch Enrich] Found ${brands?.length || 0} brands to process`);

    // 3) Create run record
    const { data: run, error: runError } = await supabase
      .from('enrichment_runs')
      .insert({
        mode: dry_run ? 'dry-run' : 'batch',
        total: brands?.length || 0
      })
      .select()
      .single();

    if (runError) throw runError;

    const results = {
      total: brands?.length || 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ brand_id: string; brand_name: string; error: string }>,
      dry_run,
      aborted: false,
      abort_reason: null as string | null
    };

    // Circuit breaker: abort after N consecutive rate limit errors
    const MAX_CONSECUTIVE_429 = 5;
    let consecutive429Count = 0;

    if (dry_run) {
      // Release lock before returning
      await supabase.from('enrichment_job_locks').delete().eq('lock_name', lockName);
      lockAcquired = false;

      return new Response(JSON.stringify({
        message: 'Dry run - no enrichment performed',
        brands_to_process: brands?.map(b => ({ id: b.id, name: b.name, wikidata_qid: b.wikidata_qid })),
        ...results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4) Process each brand with backoff + circuit breaker
    for (const brand of brands || []) {
      // Circuit breaker: stop if too many consecutive rate limits
      if (consecutive429Count >= MAX_CONSECUTIVE_429) {
        results.aborted = true;
        results.abort_reason = `Circuit breaker triggered: ${consecutive429Count} consecutive 429 errors`;
        console.error(`[Batch Enrich] ${results.abort_reason}`);
        
        // Mark remaining brands as skipped
        for (let i = results.processed; i < (brands?.length || 0); i++) {
          const remainingBrand = brands![i];
          await supabase.from('enrichment_run_items').insert({
            run_id: run.id,
            brand_id: remainingBrand.id,
            brand_name: remainingBrand.name,
            wikidata_qid: remainingBrand.wikidata_qid,
            status: 'skip',
            error: 'Aborted due to rate limiting'
          });
        }
        break;
      }

      results.processed++;
      
      try {
        console.log(`[${results.processed}/${results.total}] Enriching ${brand.name} (${brand.wikidata_qid})`);

        // Call enrich-brand-wiki with backoff
        await withBackoff(async () => {
          const { error: enrichError } = await supabase.functions.invoke(
            'enrich-brand-wiki',
            {
              body: {
                brand_id: brand.id,
                wikidata_qid: brand.wikidata_qid,
                mode: 'full' // CRITICAL: Use full mode to get ownership + people
              }
            }
          );

          if (enrichError) throw enrichError;
        });

        // Success - reset circuit breaker
        consecutive429Count = 0;

        // Log success
        await supabase.from('enrichment_run_items').insert({
          run_id: run.id,
          brand_id: brand.id,
          brand_name: brand.name,
          wikidata_qid: brand.wikidata_qid,
          status: 'ok'
        });

        // Small delay to avoid rate limiting Wikidata
        await new Promise(resolve => setTimeout(resolve, 500));
        
        results.succeeded++;
        console.log(`[Success] ${brand.name} enriched successfully`);

      } catch (error: any) {
        console.error(`[Error] ${brand.name}:`, error);
        results.failed++;
        
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const status = error?.status || error?.response?.status;
        
        // Track consecutive 429s for circuit breaker
        if (status === 429) {
          consecutive429Count++;
          console.warn(`[429 Rate Limit] Count: ${consecutive429Count}/${MAX_CONSECUTIVE_429}`);
        } else {
          consecutive429Count = 0; // Reset on non-429 errors
        }
        
        results.errors.push({
          brand_id: brand.id,
          brand_name: brand.name,
          error: errorMsg
        });

        // Log failure
        await supabase.from('enrichment_run_items').insert({
          run_id: run.id,
          brand_id: brand.id,
          brand_name: brand.name,
          wikidata_qid: brand.wikidata_qid,
          status: 'error',
          error: errorMsg
        });
      }
    }

    // 5) Update run record
    await supabase
      .from('enrichment_runs')
      .update({
        finished_at: new Date().toISOString(),
        succeeded: results.succeeded,
        failed: results.failed,
        errors: results.errors
      })
      .eq('id', run.id);

    // 6) Release lock
    await supabase.from('enrichment_job_locks').delete().eq('lock_name', lockName);
    lockAcquired = false;

    const statusMsg = results.aborted 
      ? `Batch enrichment aborted: ${results.abort_reason}`
      : `Batch enrichment complete: ${results.succeeded} succeeded, ${results.failed} failed`;
    
    console.log(`[Batch Enrich] ${statusMsg}`);

    return new Response(JSON.stringify({
      message: statusMsg,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: results.aborted ? 429 : 200
    });

  } catch (error) {
    console.error('[Batch Enrich] Fatal error:', error);
    
    // Release lock on error
    if (lockAcquired) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabase.from('enrichment_job_locks').delete().eq('lock_name', lockName);
      } catch {}
    }

    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
