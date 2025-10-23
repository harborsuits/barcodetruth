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

  const lockName = 'enrich-all-brands-cron';
  let lockAcquired = false;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1) Acquire lock with jitter (avoid thundering herd)
    await new Promise(r => setTimeout(r, Math.random() * 600000)); // 0-10 min jitter

    const { data: gotLock, error: lockErr } = await supabase
      .from('enrichment_job_locks')
      .insert({ lock_name: lockName, owner: 'cron:enrich-all-brands' })
      .select()
      .single();

    if (lockErr && lockErr.code !== '23505') {
      throw lockErr;
    }
    if (lockErr?.code === '23505') {
      console.log('[Enrich Cron] Another job is running, skipping');
      return new Response(JSON.stringify({
        message: 'Another enrichment job is running, skipped this run'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    lockAcquired = true;

    // 2) Get brands using fair rotation (prioritizes stale + oldest)
    const { data: brands, error: fetchError } = await supabase.rpc('get_next_brands_fair_rotation', {
      p_limit: 20 // Process 20 brands per run
    });

    if (fetchError) throw fetchError;

    console.log(`[Enrich Cron] Processing ${brands?.length || 0} brands`);

    // 3) Create run record
    const { data: run, error: runError } = await supabase
      .from('enrichment_runs')
      .insert({
        mode: 'cron',
        total: brands?.length || 0
      })
      .select()
      .single();

    if (runError) throw runError;

    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ brand_id: string; brand_name: string; error: string }> = [];

    // 4) Process each brand with backoff
    for (const brand of brands || []) {
      try {
        // Get Wikidata QID
        const { data: brandData } = await supabase
          .from('brands')
          .select('wikidata_qid')
          .eq('id', brand.brand_id)
          .single();

        if (!brandData?.wikidata_qid) {
          console.log(`[Skip] ${brand.brand_name}: No Wikidata QID`);
          await supabase.from('enrichment_run_items').insert({
            run_id: run.id,
            brand_id: brand.brand_id,
            brand_name: brand.brand_name,
            status: 'skip',
            error: 'No Wikidata QID'
          });
          continue;
        }

        // Enrich with backoff
        await withBackoff(async () => {
          const { error: enrichError } = await supabase.functions.invoke('enrich-brand-wiki', {
            body: {
              brand_id: brand.brand_id,
              wikidata_qid: brandData.wikidata_qid,
              mode: 'full'
            }
          });

          if (enrichError) throw enrichError;
        });

        succeeded++;
        console.log(`[Success] ${brand.brand_name} enriched`);

        // Log success
        await supabase.from('enrichment_run_items').insert({
          run_id: run.id,
          brand_id: brand.brand_id,
          brand_name: brand.brand_name,
          wikidata_qid: brandData.wikidata_qid,
          status: 'ok'
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Error] ${brand.brand_name}:`, error);
        
        errors.push({
          brand_id: brand.brand_id,
          brand_name: brand.brand_name,
          error: errorMsg
        });

        // Log failure
        await supabase.from('enrichment_run_items').insert({
          run_id: run.id,
          brand_id: brand.brand_id,
          brand_name: brand.brand_name,
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
        succeeded,
        failed,
        errors
      })
      .eq('id', run.id);

    // 6) Release lock
    await supabase.from('enrichment_job_locks').delete().eq('lock_name', lockName);
    lockAcquired = false;

    console.log(`[Enrich Cron] Complete: ${succeeded} succeeded, ${failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      processed: brands?.length || 0,
      succeeded,
      failed,
      errors: errors.slice(0, 5) // Return first 5 errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Enrich Cron] Fatal error:', error);
    
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
