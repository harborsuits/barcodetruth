import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_BATCH = 25;
const LOCK_TIMEOUT_MS = 90_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch unlocked jobs ready to run
    const { data: jobs, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .lte('not_before', new Date().toISOString())
      .is('locked_by', null)
      .order('created_at', { ascending: true })
      .limit(MAX_BATCH);

    if (fetchError) {
      console.error('Error fetching jobs:', fetchError);
      throw fetchError;
    }

    if (!jobs?.length) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: 'No jobs to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const workerId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Lock jobs optimistically
    const jobIds = jobs.map(j => j.id);
    const { error: lockError } = await supabase
      .from('jobs')
      .update({ locked_by: workerId, locked_at: now })
      .in('id', jobIds)
      .is('locked_by', null);

    if (lockError) {
      console.error('Error locking jobs:', lockError);
    }

    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        console.log(`Processing job ${job.id} (${job.stage})`);

        if (job.stage === 'verify_event') {
          // Call verify-event function
          const { error } = await supabase.functions.invoke('verify-event', {
            body: { event_id: job.payload.event_id }
          });
          if (error) throw error;

        } else if (job.stage === 'score_brand') {
          // Call calculate-brand-score function
          const { error } = await supabase.functions.invoke('calculate-brand-score', {
            body: { brand_id: job.payload.brand_id }
          });
          if (error) throw error;

        } else if (job.stage === 'ingest_event') {
          // Parse payload and insert event + sources
          const { brand_id, title, description, category, event_date, sources, impacts } = job.payload;
          
          // Generate event_id and dedupe_hash
          const event_id = `evt_${crypto.randomUUID()}`;
          
          // Insert event
          const { error: eventError } = await supabase
            .from('brand_events')
            .insert({
              event_id,
              brand_id,
              title,
              description,
              category: category || 'general',
              event_date,
              impact_labor: impacts?.labor,
              impact_environment: impacts?.environment,
              impact_politics: impacts?.politics,
              impact_social: impacts?.social,
              ingested_from: job.payload.ingested_from || 'manual',
            });

          if (eventError) throw eventError;

          // Insert sources if provided
          if (sources && Array.isArray(sources)) {
            const sourcesData = sources.map((s: any) => ({
              event_id,
              source_name: s.name,
              source_url: s.url,
              source_quote: s.quote,
              published_at: s.published_at,
            }));

            const { error: sourcesError } = await supabase
              .from('event_sources')
              .insert(sourcesData);

            if (sourcesError) throw sourcesError;
          }

          // Queue verification job
          await supabase.from('jobs').insert({
            stage: 'verify_event',
            payload: { event_id },
          });

          // Queue scoring job
          await supabase.from('jobs').insert({
            stage: 'score_brand',
            payload: { brand_id },
          });

        } else if (job.stage === 'publish_snapshots') {
          // Placeholder for snapshot/cache publishing
          console.log('Publishing snapshots (not yet implemented)');
        }

        // Job completed successfully - delete it
        await supabase.from('jobs').delete().eq('id', job.id);
        processed++;
        console.log(`Job ${job.id} completed successfully`);

      } catch (err) {
        failed++;
        const attempts = (job.attempts ?? 0) + 1;
        const maxAttempts = 3;

        console.error(`Job ${job.id} failed (attempt ${attempts}/${maxAttempts}):`, err);

        if (attempts >= maxAttempts) {
          // Max retries exceeded - delete the job
          console.error(`Job ${job.id} exceeded max attempts, deleting`);
          await supabase.from('jobs').delete().eq('id', job.id);
        } else {
          // Exponential backoff: 1s, 5s, 30s
          const backoff = attempts === 1 ? 1_000 : attempts === 2 ? 5_000 : 30_000;
          const notBefore = new Date(Date.now() + backoff).toISOString();

          await supabase.from('jobs').update({
            attempts,
            last_error: String(err instanceof Error ? err.message : err),
            not_before: notBefore,
            locked_by: null,
            locked_at: null,
          }).eq('id', job.id);
        }
      }
    }

    const result = {
      ok: true,
      processed,
      failed,
      total: jobs.length,
      worker_id: workerId,
    };

    console.log('Job batch completed:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Jobs runner error:', error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
