// TICKET D: Nightly brand score recomputation (v3 - performance fix)
// Fixed: queries brand_events directly instead of slow view, chunks .in() calls, batches writes
import { createClient } from 'npm:@supabase/supabase-js@2';
import { compareTwoStrings } from 'https://esm.sh/string-similarity@4.0.4';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SCORE_WEIGHTS, type SourceTier } from '../_shared/sourceTiers.ts';

const RECENCY_WEIGHTS = {
  '0-30': 1.0,
  '31-90': 0.7,
  '91-365': 0.4,
  '366-730': 0.2,
  '731+': 0.1,
};

const MAX_SCORE_ELIGIBLE_EVENTS_PER_BRAND = 50;
const CHUNK_SIZE = 300; // For .in() queries

const VERIFICATION_WEIGHTS = {
  official: 1.0,
  corroborated: 0.8,
  unverified: 0.4,
};

function communityMultiplier(upvotes = 0, downvotes = 0): number {
  const total = upvotes + downvotes;
  if (total < 5) return 1.0;
  const ratio = upvotes / total;
  if (ratio >= 0.8) return 1.15;
  if (ratio >= 0.6) return 1.0;
  if (ratio <= 0.2) return 0.5;
  if (ratio <= 0.4) return 0.75;
  return 1.0;
}

interface CategoryImpacts {
  labor?: number;
  environment?: number;
  politics?: number;
  social?: number;
}

interface BrandEvent {
  event_id: string;
  brand_id: string;
  event_date: string;
  title: string | null;
  verification: 'official' | 'corroborated' | 'unverified';
  category_impacts: CategoryImpacts | null;
  category: string;
  credibility: number | null;
  source_tier: SourceTier | null;
  score_eligible: boolean | null;
  upvotes: number | null;
  downvotes: number | null;
  scope_multiplier: number;
}

interface EventSource {
  event_id: string;
  canonical_url: string | null;
  source_name: string;
  registrable_domain: string | null;
  verification: string | null;
  source_date: string | null;
}

interface DimensionAccumulator {
  labor_sum: number; environment_sum: number; politics_sum: number; social_sum: number;
  labor_count: number; environment_count: number; politics_count: number; social_count: number;
  labor_worst: number; environment_worst: number; politics_worst: number; social_worst: number;
}

interface BrandScore {
  brand_id: string;
  dimensions: DimensionAccumulator;
  event_count: number;
  recent_events: number;
  per_event: Array<{
    event_id: string; date: string; title: string | null;
    canonical_url: string | null; source_name: string | null; source_domain: string | null;
    category: string; verification: string;
    w_recency: number; w_verif: number; w_comm: number;
    impacts: CategoryImpacts;
    contrib: { labor: number; environment: number; politics: number; social: number };
  }>;
}

function getRecencyWeight(eventDate: Date, now: Date): number {
  const daysDiff = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff <= 30) return RECENCY_WEIGHTS['0-30'];
  if (daysDiff <= 90) return RECENCY_WEIGHTS['31-90'];
  if (daysDiff <= 365) return RECENCY_WEIGHTS['91-365'];
  if (daysDiff <= 730) return RECENCY_WEIGHTS['366-730'];
  return RECENCY_WEIGHTS['731+'];
}

function getVerificationWeight(v: string): number {
  return VERIFICATION_WEIGHTS[v as keyof typeof VERIFICATION_WEIGHTS] || VERIFICATION_WEIGHTS.unverified;
}

/** Chunk an array into smaller arrays */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/** Dedup events by title similarity within same brand + 7-day window */
function deduplicateForScoring(events: BrandEvent[]): BrandEvent[] {
  const byBrand = new Map<string, BrandEvent[]>();
  for (const e of events) {
    if (!byBrand.has(e.brand_id)) byBrand.set(e.brand_id, []);
    byBrand.get(e.brand_id)!.push(e);
  }

  const result: BrandEvent[] = [];
  let totalDuplicates = 0;

  for (const [, brandEvents] of byBrand) {
    const processed = new Set<string>();
    const sorted = [...brandEvents].sort((a, b) =>
      new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );

    for (const event of sorted) {
      if (processed.has(event.event_id)) continue;
      const eventDate = new Date(event.event_date).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      const duplicates = sorted.filter(other => {
        if (other.event_id === event.event_id || processed.has(other.event_id)) return false;
        if (other.category !== event.category) return false;
        if (Math.abs(new Date(other.event_date).getTime() - eventDate) > sevenDays) return false;
        const t1 = (event.title || '').toLowerCase();
        const t2 = (other.title || '').toLowerCase();
        if (!t1 || !t2) return false;
        return compareTwoStrings(t1, t2) > 0.75;
      });

      duplicates.forEach(d => processed.add(d.event_id));
      processed.add(event.event_id);
      totalDuplicates += duplicates.length;

      const credibilityBoost = Math.min(1.0 + (duplicates.length * 0.1), 1.5);
      result.push({ ...event, credibility: (event.credibility ?? 0.6) * credibilityBoost });
    }
  }

  console.log(`[Dedup] Merged ${totalDuplicates} duplicates across ${byBrand.size} brands`);
  return result;
}

function computeDimensionScore(sum: number, eventCount: number, worstImpact: number): number {
  const SCALE = 2.5;
  const normFactor = eventCount > 0 ? Math.sqrt(eventCount) : 1;
  let normalized = sum / normFactor;

  const MIN_INFLUENCE = 0.6;
  if (worstImpact < 0 && normalized > worstImpact * MIN_INFLUENCE) {
    normalized = worstImpact * MIN_INFLUENCE;
  } else if (worstImpact > 0 && normalized < worstImpact * MIN_INFLUENCE) {
    normalized = worstImpact * MIN_INFLUENCE;
  }

  return Math.max(0, Math.min(100, Math.round(50 + normalized * SCALE)));
}

function applyScoreFloor(score: number, eventCount: number): number {
  if (score === 0 && eventCount < 3) return 10;
  if (score === 100 && eventCount < 3) return 90;
  return score;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  let runId: string | undefined;

  try {
    console.log('Starting brand score recomputation (v3 - performance fix)...');

    const { data: runRecord } = await supabase
      .from('score_runs')
      .insert({ status: 'running' })
      .select('id')
      .single();
    runId = runRecord?.id;

    const now = new Date();

    // ── STEP 1: Fetch events DIRECTLY from brand_events (not the slow view) ──
    // Paginate to avoid timeout on large tables
    const allEvents: BrandEvent[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;

    while (true) {
      const { data: batch, error } = await supabase
        .from('brand_events')
        .select('event_id, brand_id, title, event_date, verification, category_impacts, category, credibility, source_tier, score_eligible, upvotes, downvotes')
        .order('event_date', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        console.error(`Failed to fetch events page ${page}:`, error);
        throw error;
      }

      if (!batch || batch.length === 0) break;

      for (const e of batch) {
        allEvents.push({ ...e, scope_multiplier: 1.0 } as BrandEvent);
      }

      console.log(`Fetched page ${page}: ${batch.length} events (total: ${allEvents.length})`);
      if (batch.length < PAGE_SIZE) break;
      page++;
    }

    if (allEvents.length === 0) {
      console.log('No events found');
      return new Response(
        JSON.stringify({ message: 'No events to process', brands_updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── STEP 2: Add inherited parent events for child brands ──
    // Resolve parent_company (text name) → parent brand ID, then inherit events
    const { data: childBrands } = await supabase
      .from('brands')
      .select('id, parent_company')
      .not('parent_company', 'is', null)
      .neq('parent_company', '');

    if (childBrands && childBrands.length > 0) {
      // Build a name→id lookup for all brands (case-insensitive)
      const parentNames = [...new Set(childBrands.map(b => b.parent_company))];
      const { data: parentBrands } = await supabase
        .from('brands')
        .select('id, name')
        .in('name', parentNames);

      const nameToId = new Map<string, string>();
      (parentBrands || []).forEach(p => nameToId.set(p.name, p.id));

      // Build parent event map from already-fetched events
      const parentIds = new Set([...nameToId.values()]);
      const parentEventMap = new Map<string, BrandEvent[]>();
      for (const e of allEvents) {
        if (parentIds.has(e.brand_id)) {
          if (!parentEventMap.has(e.brand_id)) parentEventMap.set(e.brand_id, []);
          parentEventMap.get(e.brand_id)!.push(e);
        }
      }

      let inheritedCount = 0;
      for (const child of childBrands) {
        const parentId = nameToId.get(child.parent_company);
        if (!parentId) continue;
        const parentEvents = parentEventMap.get(parentId) || [];
        for (const pe of parentEvents) {
          allEvents.push({
            ...pe,
            brand_id: child.id, // Attribute to child
            scope_multiplier: 0.7, // Inherited events reduced influence
          });
          inheritedCount++;
        }
      }
      console.log(`Added ${inheritedCount} inherited events for ${childBrands.length} child brands (resolved via parent_company name)`);
    }

    console.log(`Total events (with inheritance): ${allEvents.length}`);

    // ── STEP 3: Dedup + cap ──
    const dedupedEvents = deduplicateForScoring(allEvents);
    console.log(`After dedup: ${dedupedEvents.length} unique events`);

    const cappedEvents: BrandEvent[] = [];
    const brandEventCounts = new Map<string, number>();
    const sortedDeduped = [...dedupedEvents].sort((a, b) =>
      new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );

    let cappedCount = 0;
    for (const event of sortedDeduped) {
      const count = brandEventCounts.get(event.brand_id) || 0;
      if (count >= MAX_SCORE_ELIGIBLE_EVENTS_PER_BRAND) { cappedCount++; continue; }
      brandEventCounts.set(event.brand_id, count + 1);
      cappedEvents.push(event);
    }
    if (cappedCount > 0) console.log(`[Cap] Dropped ${cappedCount} excess events`);

    // ── STEP 4: Fetch sources in CHUNKS (not one giant .in()) ──
    const eventIds = cappedEvents.map(e => e.event_id);
    const bestSourceByEvent = new Map<string, EventSource>();

    for (const idChunk of chunk(eventIds, CHUNK_SIZE)) {
      const { data: sources } = await supabase
        .from('event_sources')
        .select('event_id, canonical_url, source_name, registrable_domain, verification, source_date')
        .in('event_id', idChunk);

      if (sources) {
        for (const source of sources as EventSource[]) {
          const existing = bestSourceByEvent.get(source.event_id);
          if (!existing ||
              source.verification === 'official' ||
              (existing.verification !== 'official' && source.source_date && (!existing.source_date || source.source_date < existing.source_date))) {
            bestSourceByEvent.set(source.event_id, source);
          }
        }
      }
    }
    console.log(`Mapped sources for ${bestSourceByEvent.size} events`);

    // ── STEP 5: Compute scores ──
    const brandScoresMap = new Map<string, BrandScore>();
    let eventsWithImpacts = 0;
    let eventsWithoutImpacts = 0;
    let eventsSkippedTier3 = 0;

    for (const event of cappedEvents) {
      if (!event.score_eligible) { eventsSkippedTier3++; continue; }

      const eventDate = new Date(event.event_date);
      const recencyWeight = getRecencyWeight(eventDate, now);
      const verificationWeight = getVerificationWeight(event.verification);
      const credibilityWeight = event.credibility ?? 0.6;
      const tierWeight = TIER_SCORE_WEIGHTS[(event.source_tier as SourceTier) ?? 'tier_3'];

      const impacts: CategoryImpacts = event.category_impacts || {};
      const hasImpacts = Object.values(impacts).some(v => v !== 0 && v !== undefined);
      if (hasImpacts) eventsWithImpacts++; else eventsWithoutImpacts++;

      const combinedWeight = recencyWeight * verificationWeight * credibilityWeight * tierWeight;
      const commMult = communityMultiplier(event.upvotes ?? 0, event.downvotes ?? 0);
      const scopeMultiplier = event.scope_multiplier ?? 1.0;

      const laborContrib = (impacts.labor || 0) * combinedWeight * scopeMultiplier * commMult;
      const envContrib = (impacts.environment || 0) * combinedWeight * scopeMultiplier * commMult;
      const politicsContrib = (impacts.politics || 0) * combinedWeight * scopeMultiplier * commMult;
      const socialContrib = (impacts.social || 0) * combinedWeight * scopeMultiplier * commMult;

      if (!brandScoresMap.has(event.brand_id)) {
        brandScoresMap.set(event.brand_id, {
          brand_id: event.brand_id,
          dimensions: {
            labor_sum: 0, environment_sum: 0, politics_sum: 0, social_sum: 0,
            labor_count: 0, environment_count: 0, politics_count: 0, social_count: 0,
            labor_worst: 0, environment_worst: 0, politics_worst: 0, social_worst: 0,
          },
          event_count: 0, recent_events: 0, per_event: [],
        });
      }

      const bs = brandScoresMap.get(event.brand_id)!;
      bs.dimensions.labor_sum += laborContrib;
      bs.dimensions.environment_sum += envContrib;
      bs.dimensions.politics_sum += politicsContrib;
      bs.dimensions.social_sum += socialContrib;

      if (impacts.labor) {
        bs.dimensions.labor_count++;
        if (laborContrib < bs.dimensions.labor_worst) bs.dimensions.labor_worst = laborContrib;
        else if (laborContrib > 0 && laborContrib > bs.dimensions.labor_worst) bs.dimensions.labor_worst = laborContrib;
      }
      if (impacts.environment) {
        bs.dimensions.environment_count++;
        if (envContrib < bs.dimensions.environment_worst) bs.dimensions.environment_worst = envContrib;
        else if (envContrib > 0 && envContrib > bs.dimensions.environment_worst) bs.dimensions.environment_worst = envContrib;
      }
      if (impacts.politics) {
        bs.dimensions.politics_count++;
        if (politicsContrib < bs.dimensions.politics_worst) bs.dimensions.politics_worst = politicsContrib;
        else if (politicsContrib > 0 && politicsContrib > bs.dimensions.politics_worst) bs.dimensions.politics_worst = politicsContrib;
      }
      if (impacts.social) {
        bs.dimensions.social_count++;
        if (socialContrib < bs.dimensions.social_worst) bs.dimensions.social_worst = socialContrib;
        else if (socialContrib > 0 && socialContrib > bs.dimensions.social_worst) bs.dimensions.social_worst = socialContrib;
      }

      bs.event_count += 1;
      const daysSince = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince <= 30) bs.recent_events += 1;

      const bestSource = bestSourceByEvent.get(event.event_id);
      bs.per_event.push({
        event_id: event.event_id,
        date: event.event_date,
        title: event.title,
        canonical_url: bestSource?.canonical_url ?? null,
        source_name: bestSource?.source_name ?? null,
        source_domain: bestSource?.registrable_domain ?? null,
        category: event.category,
        verification: event.verification,
        w_recency: Math.round(recencyWeight * 100) / 100,
        w_verif: Math.round(verificationWeight * 100) / 100,
        w_comm: Math.round(commMult * 100) / 100,
        impacts,
        contrib: {
          labor: Math.round(laborContrib * 1000) / 1000,
          environment: Math.round(envContrib * 1000) / 1000,
          politics: Math.round(politicsContrib * 1000) / 1000,
          social: Math.round(socialContrib * 1000) / 1000,
        },
      });
    }

    console.log(`Events with impacts: ${eventsWithImpacts}, without: ${eventsWithoutImpacts}, tier3 skipped: ${eventsSkippedTier3}`);
    console.log(`Computed scores for ${brandScoresMap.size} brands`);

    // ── STEP 6: Fetch ALL previous scores in one query (not N+1) ──
    const brandIds = [...brandScoresMap.keys()];
    const previousScores = new Map<string, number | null>();
    for (const idChunk of chunk(brandIds, CHUNK_SIZE)) {
      const { data: prevData } = await supabase
        .from('brand_scores')
        .select('brand_id, score')
        .in('brand_id', idChunk);
      if (prevData) {
        for (const row of prevData) {
          previousScores.set(row.brand_id, row.score);
        }
      }
    }

    // ── STEP 7: Batch upsert scores + audit rows ──
    let updatedCount = 0;
    const auditRows: any[] = [];
    const scoreUpserts: any[] = [];
    const eventUpdates: Array<{ event_id: string; decay_multiplier: number; weighted_impact_score: number; community_multiplier: number }> = [];

    for (const [brandId, brandData] of brandScoresMap) {
      const scoreLabor = applyScoreFloor(computeDimensionScore(brandData.dimensions.labor_sum, brandData.dimensions.labor_count, brandData.dimensions.labor_worst), brandData.dimensions.labor_count);
      const scoreEnv = applyScoreFloor(computeDimensionScore(brandData.dimensions.environment_sum, brandData.dimensions.environment_count, brandData.dimensions.environment_worst), brandData.dimensions.environment_count);
      const scorePolitics = applyScoreFloor(computeDimensionScore(brandData.dimensions.politics_sum, brandData.dimensions.politics_count, brandData.dimensions.politics_worst), brandData.dimensions.politics_count);
      const scoreSocial = applyScoreFloor(computeDimensionScore(brandData.dimensions.social_sum, brandData.dimensions.social_count, brandData.dimensions.social_worst), brandData.dimensions.social_count);

      const totalDimEvents = brandData.dimensions.labor_count + brandData.dimensions.environment_count + brandData.dimensions.politics_count + brandData.dimensions.social_count;
      let overallScore: number;
      if (totalDimEvents > 0) {
        overallScore = Math.round(
          (scoreLabor * brandData.dimensions.labor_count + scoreEnv * brandData.dimensions.environment_count +
           scorePolitics * brandData.dimensions.politics_count + scoreSocial * brandData.dimensions.social_count) / totalDimEvents
        );
      } else {
        overallScore = Math.round((scoreLabor + scoreEnv + scorePolitics + scoreSocial) / 4);
      }

      // Collect event audit updates
      for (const pe of brandData.per_event) {
        const totalContrib = pe.contrib.labor + pe.contrib.environment + pe.contrib.politics + pe.contrib.social;
        eventUpdates.push({
          event_id: pe.event_id,
          decay_multiplier: pe.w_recency,
          weighted_impact_score: Math.round(totalContrib * 1000) / 1000,
          community_multiplier: pe.w_comm ?? 1.0,
        });
      }

      const previousScore = previousScores.get(brandId) ?? null;

      // Audit row
      let topPositiveId: string | null = null, topNegativeId: string | null = null;
      let maxPos = 0, maxNeg = 0;
      for (const pe of brandData.per_event) {
        const total = pe.contrib.labor + pe.contrib.environment + pe.contrib.politics + pe.contrib.social;
        if (total > maxPos) { maxPos = total; topPositiveId = pe.event_id; }
        if (total < maxNeg) { maxNeg = total; topNegativeId = pe.event_id; }
      }
      const dates = brandData.per_event.map(pe => new Date(pe.date).getTime()).filter(d => !isNaN(d));
      const dateStart = dates.length > 0 ? new Date(Math.min(...dates)).toISOString().split('T')[0] : null;
      const dateEnd = dates.length > 0 ? new Date(Math.max(...dates)).toISOString().split('T')[0] : null;
      const eventsThatMoved = brandData.per_event.filter(pe => {
        const t = pe.contrib.labor + pe.contrib.environment + pe.contrib.politics + pe.contrib.social;
        return Math.abs(t) > 0.01;
      }).length;

      auditRows.push({
        brand_id: brandId,
        classifier_version: 'v3-perf',
        score_labor: scoreLabor, score_environment: scoreEnv, score_social: scoreSocial, score_politics: scorePolitics,
        score_overall: overallScore,
        previous_score_overall: previousScore != null ? Math.round(previousScore) : null,
        score_delta: previousScore != null ? overallScore - Math.round(previousScore) : null,
        events_considered: allEvents.length,
        events_after_dedup: dedupedEvents.length,
        events_after_cap: cappedEvents.length,
        events_that_moved_score: eventsThatMoved,
        date_range_start: dateStart, date_range_end: dateEnd,
        top_positive_event_id: topPositiveId, top_negative_event_id: topNegativeId,
      });

      const reasonJson = {
        version: 3,
        window: { from: 'all-time', to: now.toISOString().split('T')[0] },
        coeffs: { recency: RECENCY_WEIGHTS, verification: VERIFICATION_WEIGHTS },
        dimension_sums: {
          labor: Math.round(brandData.dimensions.labor_sum * 1000) / 1000,
          environment: Math.round(brandData.dimensions.environment_sum * 1000) / 1000,
          politics: Math.round(brandData.dimensions.politics_sum * 1000) / 1000,
          social: Math.round(brandData.dimensions.social_sum * 1000) / 1000,
        },
        dimension_counts: {
          labor: brandData.dimensions.labor_count, environment: brandData.dimensions.environment_count,
          politics: brandData.dimensions.politics_count, social: brandData.dimensions.social_count,
        },
        scores: { labor: scoreLabor, environment: scoreEnv, politics: scorePolitics, social: scoreSocial, overall: overallScore },
        event_count: brandData.event_count,
        recent_events_30d: brandData.recent_events,
        computed_at: now.toISOString(),
        per_event: brandData.per_event.slice(0, 50),
      };

      scoreUpserts.push({
        brand_id: brandId,
        score: overallScore,
        updated_at: now.toISOString(),
        reason_json: reasonJson,
        score_labor: scoreLabor,
        score_environment: scoreEnv,
        score_politics: scorePolitics,
        score_social: scoreSocial,
        breakdown: reasonJson,
        last_updated: now.toISOString(),
      });
    }

    // Batch upsert scores in chunks
    for (const upsertChunk of chunk(scoreUpserts, 50)) {
      const { error: upsertError } = await supabase
        .from('brand_scores')
        .upsert(upsertChunk, { onConflict: 'brand_id' });
      if (upsertError) {
        console.error('Score upsert error:', upsertError);
      } else {
        updatedCount += upsertChunk.length;
      }
    }

    // Batch insert audit rows
    for (const auditChunk of chunk(auditRows, 50)) {
      try {
        await supabase.from('brand_score_audit').insert(auditChunk);
      } catch (e) {
        console.error('[Audit] batch insert error:', e);
      }
    }

    // Batch update event audit trail (fire-and-forget, non-blocking)
    // Only update unique event_ids (inherited events may duplicate)
    const uniqueUpdates = new Map<string, typeof eventUpdates[0]>();
    for (const u of eventUpdates) {
      uniqueUpdates.set(u.event_id, u);
    }
    const updateArr = [...uniqueUpdates.values()];
    for (const updateChunk of chunk(updateArr, 100)) {
      // Use individual updates since we can't batch-update different values
      // But do them concurrently for speed
      await Promise.allSettled(
        updateChunk.map(u =>
          supabase.from('brand_events').update({
            decay_multiplier: u.decay_multiplier,
            weighted_impact_score: u.weighted_impact_score,
            community_multiplier: u.community_multiplier,
          }).eq('event_id', u.event_id)
        )
      );
    }

    console.log(`Updated scores for ${updatedCount} brands`);

    // Refresh coverage
    console.log('Refreshing brand coverage...');
    const { error: refreshError } = await supabase.rpc('refresh_brand_coverage');
    if (refreshError) console.error('Coverage refresh failed:', refreshError);
    else console.log('Coverage refreshed');

    if (runId) {
      await supabase.from('score_runs').update({
        status: 'ok',
        finished_at: new Date().toISOString(),
        events_count: allEvents.length,
        brands_updated: updatedCount,
        details: { message: 'Success (v3 perf)', events_with_impacts: eventsWithImpacts, events_without_impacts: eventsWithoutImpacts }
      }).eq('id', runId);
    }

    return new Response(
      JSON.stringify({
        message: 'Brand scores recomputed (v3)',
        brands_updated: updatedCount,
        events_processed: allEvents.length,
        events_with_impacts: eventsWithImpacts,
        events_without_impacts: eventsWithoutImpacts,
        timestamp: now.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Recompute error:', error);

    if (runId) {
      try {
        await supabase.from('score_runs').update({
          status: 'error', finished_at: new Date().toISOString(), details: { error: errorMessage }
        }).eq('id', runId);
      } catch {}
    }

    return new Response(
      JSON.stringify({ error: 'Failed to recompute scores', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
