import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { InternalEvent, EPAFacility, createEventSource } from "../lib/epa.ts";

export interface UpsertResult {
  inserted: string[];
  skipped: number;
}

/**
 * Upsert events with idempotent deduplication
 */
export async function upsertEvents(
  supabase: SupabaseClient,
  events: { event: InternalEvent; facility: EPAFacility }[],
  dryrun: boolean = false
): Promise<UpsertResult> {
  const inserted: string[] = [];
  let skipped = 0;

  for (const { event, facility } of events) {
    // Check if we already have this event (fast dedupe via source_url)
    const { data: existing } = await supabase
      .from('brand_events')
      .select('event_id')
      .eq('brand_id', event.brand_id)
      .eq('source_url', event.source_url)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[upsert] Skipping duplicate: ${event.source_url}`);
      skipped++;
      continue;
    }

    if (dryrun) {
      console.log(`[upsert] [DRYRUN] Would insert event:`, event);
      inserted.push('dryrun-' + event.source_url);
      continue;
    }

    // Insert event
    const { data: eventData, error: eventError } = await supabase
      .from('brand_events')
      .insert(event)
      .select('event_id')
      .single();

    if (eventError) {
      // Check if it's a unique violation (race condition)
      if (eventError.code === '23505') {
        console.log(`[upsert] Duplicate detected via constraint: ${event.source_url}`);
        skipped++;
        continue;
      }
      console.error('[upsert] Error inserting event:', eventError);
      continue;
    }

    // Insert source
    const eventSource = createEventSource(eventData.event_id, facility, event.source_url);
    
    const { error: sourceError } = await supabase
      .from('event_sources')
      .upsert(eventSource, { 
        onConflict: 'event_id,source_url', 
        ignoreDuplicates: true 
      });

    if (sourceError) {
      console.error('[upsert] Error inserting source:', sourceError);
    }

    console.log(`[upsert] ✅ evidence_source_primary_inserted: event=${eventData.event_id}, source=EPA, domain=echo.epa.gov`);
    inserted.push(eventData.event_id);
  }

  return { inserted, skipped };
}

/**
 * Log deferred brand for retry
 */
export async function logDefer(
  supabase: SupabaseClient,
  params: {
    brand_id: string;
    query: string;
    reason: string;
    detail?: string;
  }
) {
  const { error } = await supabase
    .from('ingestion_log')
    .insert({
      source: 'epa',
      brand_id: params.brand_id,
      status: 'deferred',
      reason: params.reason,
      metadata: {
        query: params.query,
        detail: params.detail,
        next_attempt_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min delay
      },
    });

  if (error) {
    console.error('[logDefer] Error logging defer:', error);
  } else {
    console.log(`[logDefer] Deferred ${params.brand_id} for retry: ${params.reason}`);
  }
}

/**
 * Enqueue coalesced push notification job
 */
export async function enqueueNotification(
  supabase: SupabaseClient,
  brandId: string,
  eventCount: number
) {
  // Fetch brand name for nicer notification text
  const { data: brandRow } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .maybeSingle();

  // 5-minute coalescing bucket key
  const bucketSec = Math.floor(Date.now() / (5 * 60 * 1000)) * 5 * 60;
  const coalesceKey = `${brandId}:${bucketSec}`;

  const nowISO = new Date().toISOString();
  const payload = {
    brand_id: brandId,
    brand_name: brandRow?.name ?? brandId,
    at: nowISO,
    events: [
      {
        category: 'environment',
        delta: -1 * eventCount,
      },
    ],
  };

  const { error } = await supabase.rpc('upsert_coalesced_job', {
    p_stage: 'send_push_for_score_change',
    p_key: coalesceKey,
    p_payload: payload,
    p_not_before: nowISO,
  });

  if (error) {
    console.error('[enqueueNotification] Failed to enqueue coalesced job:', error);
  } else {
    console.log(`[enqueueNotification] Enqueued for ${brandRow?.name ?? brandId} (events=${eventCount})`);
  }
}
