import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_BATCH = 25;
const LOCK_TIMEOUT_SECONDS = 120; // 2 minutes

Deno.serve(async (req) => {
  const requestId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  const baseHeaders = { 
    ...corsHeaders, 
    'Content-Type': 'application/json',
    'X-Request-Id': requestId 
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: baseHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // First, unlock stale locks
    const { data: unlocked } = await supabase.rpc('unlock_stale_jobs', { 
      timeout_seconds: LOCK_TIMEOUT_SECONDS 
    });
    
    if (unlocked && unlocked > 0) {
      console.log(`[${requestId}] Unlocked ${unlocked} stale jobs`);
    }

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
      console.log(`[${requestId}] No jobs to process`);
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: 'No jobs to process' }),
        { headers: baseHeaders }
      );
    }

    const workerId = requestId; // Use request ID as worker ID for tracing
    const now = new Date().toISOString();
    
    console.log(`[${requestId}] Processing ${jobs.length} jobs`);

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
        console.log(`[${requestId}] Processing job ${job.id} (${job.stage})`);

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
          
          // Flood control: check events in last 24h
          const { data: eventCount } = await supabase.rpc('brand_events_last_24h', {
            brand_id_param: brand_id
          });
          
          if (eventCount && eventCount > 30) {
            console.warn(`[${requestId}] Flood detected for brand ${brand_id}: ${eventCount} events in 24h`);
            // Insert but don't auto-score; flag for review
            job.payload.flood_flagged = true;
          }
          
          // Generate event_id
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

          // Only queue scoring if not flood-flagged
          if (!job.payload.flood_flagged) {
            await supabase.from('jobs').insert({
              stage: 'score_brand',
              payload: { brand_id },
            });
          } else {
            console.log(`[${requestId}] Skipping auto-score for flood-flagged event ${event_id}`);
          }

        } else if (job.stage === 'publish_snapshots') {
          // Placeholder for snapshot/cache publishing
          console.log('Publishing snapshots (not yet implemented)');

        } else if (job.stage === 'send_push_for_score_change') {
          const { brand_id, brand_name, category, delta, at } = job.payload;

          // Quiet hours (10pm-7am UTC) - delay to 7am UTC
          const now = new Date();
          const hourUTC = now.getUTCHours();
          const inQuiet = hourUTC >= 22 || hourUTC < 7;
          
          if (inQuiet) {
            const next7am = new Date(now);
            // If past 22:00 UTC, schedule next day 07:00 UTC; else same day 07:00 UTC
            if (hourUTC >= 22) {
              next7am.setUTCDate(next7am.getUTCDate() + 1);
            }
            next7am.setUTCHours(7, 0, 0, 0);
            
            await supabase.from('jobs').update({
              not_before: next7am.toISOString(),
              locked_by: null,
              locked_at: null
            }).eq('id', job.id);
            
            console.log(`[${requestId}] Job ${job.id} delayed to ${next7am.toISOString()} (quiet hours)`);
            continue;
          }

          // Fetch followers who have notifications enabled for this brand
          const { data: followers, error: folErr } = await supabase
            .from('user_follows')
            .select('user_id')
            .eq('brand_id', brand_id)
            .eq('notifications_enabled', true);

          if (folErr) throw folErr;

          if (!followers?.length) {
            console.log(`[${requestId}] No followers for ${brand_id}; deleting job`);
            await supabase.from('jobs').delete().eq('id', job.id);
            continue;
          }

          const followerIds = followers.map(f => f.user_id);

          // Fetch push subscriptions only for followers
          const { data: subs, error: subErr } = await supabase
            .from('user_push_subs')
            .select('endpoint, p256dh, auth, user_id')
            .in('user_id', followerIds);

          if (subErr) throw subErr;

          if (!subs?.length) {
            console.log(`[${requestId}] Followers have no push subscriptions; deleting job`);
            await supabase.from('jobs').delete().eq('id', job.id);
            continue;
          }

          // Filter by rate limit (max 2 per user per brand per day)
          let sentCount = 0;
          let rateLimited = 0;

          for (const sub of subs) {
            // Check rate limit
            const { data: allowed } = await supabase.rpc('allow_push_send', {
              p_user_id: sub.user_id,
              p_brand: brand_id,
              p_category: category
            });

            if (!allowed) {
              rateLimited++;
              continue;
            }

            // Send push notification
            try {
              const { error: fnErr } = await supabase.functions.invoke('send-push-notification', {
                body: { 
                  subscription: { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                  brand_id, 
                  brand_name, 
                  category, 
                  delta 
                }
              });

              // Log the attempt
              await supabase.from('notification_log').insert({
                user_id: sub.user_id,
                brand_id,
                category,
                delta,
                success: !fnErr,
                error: fnErr ? String(fnErr.message ?? fnErr) : null,
                sent_at: new Date().toISOString()
              });

              if (!fnErr) sentCount++;
            } catch (err) {
              console.error(`[${requestId}] Failed to send push to ${sub.endpoint.substring(0, 50)}:`, err);
            }
          }

          console.log(`[${requestId}] Push notification batch: sent=${sentCount}, rate_limited=${rateLimited}, followers=${followers.length}`);
          await supabase.from('jobs').delete().eq('id', job.id);
        }

        // Job completed successfully - delete it
        await supabase.from('jobs').delete().eq('id', job.id);
        processed++;
        console.log(`[${requestId}] Job ${job.id} completed successfully`);

      } catch (err) {
        failed++;
        const attempts = (job.attempts ?? 0) + 1;
        const maxAttempts = 3;

        console.error(`[${requestId}] Job ${job.id} failed (attempt ${attempts}/${maxAttempts}):`, err);

        if (attempts >= maxAttempts) {
          // Max retries exceeded - move to dead-letter queue
          console.error(`[${requestId}] Job ${job.id} exceeded max attempts, moving to dead-letter`);
          
          await supabase.from('jobs_dead').insert({
            id: job.id,
            stage: job.stage,
            payload: job.payload,
            attempts: maxAttempts,
            last_error: String(err instanceof Error ? err.message : err),
            original_created_at: job.created_at,
          });
          
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

    console.log(`[${requestId}] Job batch completed:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: baseHeaders }
    );

  } catch (error) {
    console.error(`[${requestId}] Jobs runner error:`, error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: baseHeaders }
    );
  }
});
