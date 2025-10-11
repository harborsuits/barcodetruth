import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const CURRENT_MODEL_VERSION = 'gemini-2.5-flash-v1';
const PAGE_SIZE = 50;
const MAX_DAILY_SUMMARIES = 1000;
const THROTTLE_MS = 120;

interface BackfillOptions {
  limit: number;
  dryRun: boolean;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function clampSnippet(text: string | null, maxChars = 600): string {
  if (!text) return '';
  const clean = stripHtml(text);
  return clean.length > maxChars ? clean.slice(0, maxChars) + '...' : clean;
}

async function backfillSummaries(options: BackfillOptions) {
  const { limit, dryRun } = options;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: any[] = [];
  const runId = crypto.randomUUID();

  console.log(`[backfill] Starting run ${runId}: limit=${limit}, dryRun=${dryRun}`);

  // Create run record
  if (!dryRun) {
    await supabase.from('evidence_resolution_runs').insert({
      id: runId,
      mode: 'backfill-summaries',
      started_at: new Date().toISOString(),
    });
  }

  // Check daily limit
  const today = new Date().toISOString().split('T')[0];
  const { count: todayCount } = await supabase
    .from('event_sources')
    .select('id', { count: 'exact', head: true })
    .gte('ai_summary_updated_at', today);

  if ((todayCount ?? 0) >= MAX_DAILY_SUMMARIES) {
    console.log(`[backfill] Daily limit reached: ${todayCount}/${MAX_DAILY_SUMMARIES}`);
    if (!dryRun) {
      await supabase.from('evidence_resolution_runs').update({
        finished_at: new Date().toISOString(),
        processed: 0,
        resolved: 0,
        failed: 0,
        notes: { reason: 'daily_limit_reached', todayCount }
      }).eq('id', runId);
    }
    return { processed, succeeded, failed, errors, limitReached: true };
  }

  // Process in chunks
  while (processed < limit) {
    const remaining = limit - processed;
    const pageSize = Math.min(PAGE_SIZE, remaining);

    const { data: sources, error: fetchError } = await supabase
      .from('event_sources')
      .select(`
        id,
        event_id,
        source_name,
        canonical_url,
        is_generic,
        article_title,
        article_snippet,
        credibility_tier,
        ai_summary,
        ai_model_version,
        brand_events!inner(
          brand_id,
          category,
          raw_data,
          severity,
          occurred_at,
          brands!inner(name)
        )
      `)
      .is('ai_summary', null)
      .not('article_title', 'is', null)
      .eq('is_generic', false)
      .not('canonical_url', 'is', null)
      .in('credibility_tier', ['official', 'reputable'])
      .order('id', { ascending: true })
      .limit(pageSize);

    if (fetchError) {
      console.error('[backfill] Fetch error:', fetchError);
      break;
    }

    if (!sources || sources.length === 0) {
      console.log('[backfill] No more sources to process');
      break;
    }

    // Circuit breaker: if error rate > 50% after 20 items, bail
    if (processed >= 20 && failed / processed > 0.5) {
      console.error('[backfill] Circuit breaker: high error rate, stopping');
      break;
    }

    // Hard failure floor: bail if 10+ failures with zero successes
    if (failed >= 10 && succeeded === 0) {
      console.error('[backfill] Hard failure floor: 10+ failures with no successes, stopping');
      break;
    }

    for (const source of sources) {
      try {
        // Skip if already summarized with current model
        if (source.ai_summary && source.ai_model_version === CURRENT_MODEL_VERSION) {
          processed++;
          continue;
        }

        const brandEvent = Array.isArray(source.brand_events)
          ? source.brand_events[0]
          : source.brand_events;

        const brand = Array.isArray(brandEvent?.brands)
          ? brandEvent.brands[0]
          : brandEvent?.brands;

        if (!brand || !brandEvent) {
          processed++;
          continue;
        }

        // Generate summary with high-signal fields only (sanitize inputs)
        const summaryResponse = await supabase.functions.invoke('generate-evidence-summary', {
          body: {
            brandName: brand.name,
            category: brandEvent.category,
            outlet: source.source_name,
            articleTitle: source.article_title?.trim(),
            articleSnippet: clampSnippet(source.article_snippet, 600),
            occurredAt: brandEvent.occurred_at,
            severity: brandEvent.severity,
            penaltyAmount: brandEvent.raw_data?.penalty_amount ?? null,
          }
        });

        if (summaryResponse.error) {
          throw new Error(summaryResponse.error.message || 'Summary generation failed');
        }

        const summary = summaryResponse.data?.summary;
        if (!summary) {
          throw new Error('No summary returned');
        }

        // Update with model version tracking
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('event_sources')
            .update({
              ai_summary: summary,
              ai_model_version: CURRENT_MODEL_VERSION,
              ai_summary_updated_at: new Date().toISOString()
            })
            .eq('id', source.id);

          if (updateError) {
            throw updateError;
          }
        }

        succeeded++;
        console.log(`[backfill] ✓ ${source.id}`);
      } catch (error: any) {
        failed++;
        errors.push({
          source_id: source.id,
          error: error.message
        });
        console.error(`[backfill] ✗ ${source.id}:`, error.message);
      }

      processed++;

      // Light throttle
      await new Promise(resolve => setTimeout(resolve, THROTTLE_MS));

      if (processed >= limit) break;
    }

    if (processed >= limit) break;
  }

  console.log(`[backfill] Complete run ${runId}: ${processed} processed, ${succeeded} succeeded, ${failed} failed`);
  
  // Update run record
  if (!dryRun) {
    await supabase.from('evidence_resolution_runs').update({
      finished_at: new Date().toISOString(),
      processed,
      resolved: succeeded,
      failed,
      notes: { errors: errors.slice(0, 10) } // Keep first 10 errors
    }).eq('id', runId);
  }

  return { processed, succeeded, failed, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 200, dryRun = false } = await req.json().catch(() => ({}));

    // Kick off background task without awaiting
    backfillSummaries({ limit, dryRun }).catch(err => {
      console.error('[backfill] Background task failed:', err);
    });

    return new Response(
      JSON.stringify({ status: 'started', limit, dryRun }),
      {
        status: 202,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error: any) {
    console.error('[backfill] Initialization error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
