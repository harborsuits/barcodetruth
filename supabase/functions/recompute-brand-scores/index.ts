// TICKET D: Nightly brand score recomputation
// Calculates brand scores from last 365 days of events with recency & verification weights
// FIXED: Now reads all 4 category impacts and computes per-dimension scores
// ADDED: Title-similarity deduplication to prevent multiple articles about same event counting multiple times
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

// Per-brand event cap to prevent volume bias (top brands dominating scores)
const MAX_SCORE_ELIGIBLE_EVENTS_PER_BRAND = 50;

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

const VERIFICATION_WEIGHTS = {
  official: 1.0,
  corroborated: 0.8,
  unverified: 0.4,
};

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
  // Inheritance fields for parent-child brand relationships
  inherited_from_parent?: boolean;
  parent_brand_name?: string | null;
  scope_multiplier?: number;
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
  labor_sum: number;
  environment_sum: number;
  politics_sum: number;
  social_sum: number;
  labor_count: number;
  environment_count: number;
  politics_count: number;
  social_count: number;
  // Worst single-event impact per dimension (for severity spike guard)
  labor_worst: number;
  environment_worst: number;
  politics_worst: number;
  social_worst: number;
}

interface BrandScore {
  brand_id: string;
  dimensions: DimensionAccumulator;
  event_count: number;
  recent_events: number;
  per_event: Array<{
    event_id: string;
    date: string;
    title: string | null;
    canonical_url: string | null;
    source_name: string | null;
    source_domain: string | null;
    category: string;
    verification: string;
    w_recency: number;
    w_verif: number;
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

function getVerificationWeight(verification: string): number {
  return VERIFICATION_WEIGHTS[verification as keyof typeof VERIFICATION_WEIGHTS] || VERIFICATION_WEIGHTS.unverified;
}

/**
 * Deduplicates events by title similarity (>75% match) within same brand and 7-day window.
 * Multiple articles about the same story are collapsed into one canonical event with boosted credibility.
 * 
 * Example: 11 articles about "Tyson plant closure" become 1 event with credibility 1.5x
 */
function deduplicateForScoring(events: BrandEvent[]): BrandEvent[] {
  // Group by brand_id first
  const byBrand = new Map<string, BrandEvent[]>();
  for (const event of events) {
    if (!byBrand.has(event.brand_id)) {
      byBrand.set(event.brand_id, []);
    }
    byBrand.get(event.brand_id)!.push(event);
  }
  
  const result: BrandEvent[] = [];
  let totalDuplicates = 0;
  
  for (const [brandId, brandEvents] of byBrand) {
    const processed = new Set<string>();
    
    // Sort by date to keep earliest as canonical
    const sorted = [...brandEvents].sort((a, b) => 
      new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );
    
    for (const event of sorted) {
      if (processed.has(event.event_id)) continue;
      
      const eventDate = new Date(event.event_date).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      
      // Find similar events within 7 days
      const duplicates = sorted.filter(other => {
        if (other.event_id === event.event_id) return false;
        if (processed.has(other.event_id)) return false;
        
        // Must be same category
        if (other.category !== event.category) return false;
        
        // Must be within 7 days
        const otherDate = new Date(other.event_date).getTime();
        if (Math.abs(eventDate - otherDate) > sevenDays) return false;
        
        // Title must be >75% similar
        const eventTitle = (event.title || '').toLowerCase();
        const otherTitle = (other.title || '').toLowerCase();
        if (!eventTitle || !otherTitle) return false;
        
        const similarity = compareTwoStrings(eventTitle, otherTitle);
        return similarity > 0.75;
      });
      
      // Mark all as processed
      duplicates.forEach(d => processed.add(d.event_id));
      processed.add(event.event_id);
      totalDuplicates += duplicates.length;
      
      // Create canonical event with credibility boost
      // More sources = higher credibility, capped at 1.5x
      const credibilityBoost = Math.min(1.0 + (duplicates.length * 0.1), 1.5);
      const canonical: BrandEvent = {
        ...event,
        credibility: (event.credibility ?? 0.6) * credibilityBoost,
      };
      
      result.push(canonical);
    }
  }
  
  console.log(`[Dedup] Merged ${totalDuplicates} duplicate events across ${byBrand.size} brands`);
  return result;
}

// Normalize dimension sums to 0-100 scores
// Uses hybrid normalization: sqrt(eventCount) + reduced SCALE to prevent 0/100 slamming
// This ensures:
// - Severity matters more than volume
// - Extreme scores are earned slowly
// - Brands with more coverage aren't unfairly penalized
function computeDimensionScore(sum: number, eventCount: number, worstImpact: number): number {
  // Reduced scale factor (was 5, now 2.5) for more believable score distribution
  const SCALE = 2.5;
  
  // Normalize by sqrt(eventCount) to reduce impact of high-volume coverage
  // sqrt(1)=1, sqrt(4)=2, sqrt(9)=3, sqrt(25)=5
  const normalizationFactor = eventCount > 0 ? Math.sqrt(eventCount) : 1;
  let normalizedSum = sum / normalizationFactor;
  
  // SEVERITY SPIKE GUARD: Don't let normalization dilute truly severe single events
  // Ensure normalizedSum retains at least 60% of the worst event's influence
  const MIN_INFLUENCE_RATIO = 0.6;
  if (worstImpact < 0) {
    // For negative impacts (bad events), don't let normalizedSum rise above threshold
    const worstInfluence = worstImpact * MIN_INFLUENCE_RATIO;
    if (normalizedSum > worstInfluence) {
      normalizedSum = worstInfluence;
    }
  } else if (worstImpact > 0) {
    // For positive impacts (good events), don't let normalizedSum fall below threshold
    const worstInfluence = worstImpact * MIN_INFLUENCE_RATIO;
    if (normalizedSum < worstInfluence) {
      normalizedSum = worstInfluence;
    }
  }
  
  const score = 50 + (normalizedSum * SCALE);
  
  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Soft floor guard: prevents single events from producing extreme scores
// A brand needs multiple distinct problems to truly hit 0
function applyScoreFloor(score: number, eventCount: number): number {
  if (score === 0 && eventCount < 3) {
    return 10; // Minimum "very concerning" rather than "absolute worst"
  }
  if (score === 100 && eventCount < 3) {
    return 90; // Maximum "excellent" rather than "perfect"
  }
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
    console.log('Starting brand score recomputation (v2 - per-dimension)...');
    
    // Log run start
    const { data: runRecord } = await supabase
      .from('score_runs')
      .insert({ status: 'running' })
      .select('id')
      .single();
    
    runId = runRecord?.id;
    
    const now = new Date();
    // Fetch ALL events (no date cutoff) — time decay handles recency weighting
    // Events older than 2 years still contribute at 0.1x weight (background context)

    // Fetch all score-eligible events WITH category_impacts
    // Uses brand_events_with_inheritance to include parent company events for subsidiaries
    const { data: events, error: eventsError } = await supabase
      .from('brand_events_with_inheritance')
      .select('event_id, brand_id, title, event_date, verification, category_impacts, category, credibility, source_tier, score_eligible, inherited_from_parent, parent_brand_name, scope_multiplier, upvotes, downvotes')
      .order('event_date', { ascending: false })
      .limit(5000);

    if (eventsError) {
      console.error('Failed to fetch events:', eventsError);
      throw eventsError;
    }

    if (!events || events.length === 0) {
      console.log('No events found in last 365 days');
      return new Response(
        JSON.stringify({ message: 'No events to process', brands_updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${events.length} events...`);

    // DEDUP: Collapse multiple articles about the same story into one canonical event
    const dedupedEvents = deduplicateForScoring(events as BrandEvent[]);
    console.log(`After dedup: ${dedupedEvents.length} unique events (${events.length - dedupedEvents.length} duplicates merged)`);

    // PER-BRAND CAP: Limit to top N most recent score-eligible events per brand
    // Prevents volume bias (Walmart 330 events vs median brand 5)
    const cappedEvents: BrandEvent[] = [];
    const brandEventCounts = new Map<string, number>();
    
    // Sort by date descending so we keep the most recent events
    const sortedDeduped = [...dedupedEvents].sort((a, b) => 
      new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );
    
    let cappedCount = 0;
    for (const event of sortedDeduped) {
      const count = brandEventCounts.get(event.brand_id) || 0;
      if (count >= MAX_SCORE_ELIGIBLE_EVENTS_PER_BRAND) {
        cappedCount++;
        continue;
      }
      brandEventCounts.set(event.brand_id, count + 1);
      cappedEvents.push(event);
    }
    
    if (cappedCount > 0) {
      console.log(`[Cap] Dropped ${cappedCount} excess events (>${MAX_SCORE_ELIGIBLE_EVENTS_PER_BRAND}/brand)`);
    }

    // Fetch best source per event (prefer official, then earliest)
    const eventIds = cappedEvents.map((e: BrandEvent) => e.event_id);
    const { data: sources, error: sourcesError } = await supabase
      .from('event_sources')
      .select('event_id, canonical_url, source_name, registrable_domain, verification, source_date')
      .in('event_id', eventIds);

    if (sourcesError) {
      console.error('Failed to fetch event sources:', sourcesError);
    }

    // Map best source per event (prefer official sources)
    const bestSourceByEvent = new Map<string, EventSource>();
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

    console.log(`Mapped sources for ${bestSourceByEvent.size} events`);

    // Group events by brand and compute per-dimension scores
    const brandScoresMap = new Map<string, BrandScore>();
    let eventsWithImpacts = 0;
    let eventsWithoutImpacts = 0;
    let eventsSkippedTier3 = 0;

    for (const event of cappedEvents) {
      const eventDate = new Date(event.event_date);
      const recencyWeight = getRecencyWeight(eventDate, now);
      const verificationWeight = getVerificationWeight(event.verification);
      const credibilityWeight = event.credibility ?? 0.6;
      
      // P1/P3: Hard gate — non-eligible events NEVER affect scores
      if (!event.score_eligible) {
        eventsSkippedTier3++;
        continue;
      }
      
      // Apply tier weight for eligible events (Tier 1 = 1.0, Tier 2 = 0.6)
      const tierWeight = TIER_SCORE_WEIGHTS[(event.source_tier as SourceTier) ?? 'tier_3'];
      
      // Read category_impacts - THE KEY FIX
      const impacts: CategoryImpacts = event.category_impacts || {};
      
      // Check if this event has meaningful impacts
      const hasImpacts = Object.values(impacts).some(v => v !== 0 && v !== undefined);
      if (hasImpacts) {
        eventsWithImpacts++;
      } else {
        eventsWithoutImpacts++;
      }
      
      // Combined weight includes tier weight for source credibility gating
      const combinedWeight = recencyWeight * verificationWeight * credibilityWeight * tierWeight;
      
      // Community multiplier from user votes
      const commMult = communityMultiplier(event.upvotes ?? 0, event.downvotes ?? 0);
      
      // Get scope multiplier (1.0 for direct events, 0.7 for inherited from parent)
      const scopeMultiplier = (event as BrandEvent).scope_multiplier ?? 1.0;
      
      // Calculate weighted contribution per dimension WITH scope + community multiplier
      const laborContrib = (impacts.labor || 0) * combinedWeight * scopeMultiplier * commMult;
      const envContrib = (impacts.environment || 0) * combinedWeight * scopeMultiplier * commMult;
      const politicsContrib = (impacts.politics || 0) * combinedWeight * scopeMultiplier * commMult;
      const socialContrib = (impacts.social || 0) * combinedWeight * scopeMultiplier * commMult;

      if (!brandScoresMap.has(event.brand_id)) {
        brandScoresMap.set(event.brand_id, {
          brand_id: event.brand_id,
          dimensions: {
            labor_sum: 0,
            environment_sum: 0,
            politics_sum: 0,
            social_sum: 0,
            labor_count: 0,
            environment_count: 0,
            politics_count: 0,
            social_count: 0,
            labor_worst: 0,
            environment_worst: 0,
            politics_worst: 0,
            social_worst: 0,
          },
          event_count: 0,
          recent_events: 0,
          per_event: [],
        });
      }

      const brandScore = brandScoresMap.get(event.brand_id)!;
      
      // Accumulate per-dimension scores
      brandScore.dimensions.labor_sum += laborContrib;
      brandScore.dimensions.environment_sum += envContrib;
      brandScore.dimensions.politics_sum += politicsContrib;
      brandScore.dimensions.social_sum += socialContrib;
      
      // Track event counts per dimension (for events that actually affect that dimension)
      // Also track worst single-event impact per dimension for severity spike guard
      if (impacts.labor) {
        brandScore.dimensions.labor_count++;
        if (laborContrib < brandScore.dimensions.labor_worst) {
          brandScore.dimensions.labor_worst = laborContrib;
        } else if (laborContrib > 0 && laborContrib > brandScore.dimensions.labor_worst) {
          brandScore.dimensions.labor_worst = laborContrib;
        }
      }
      if (impacts.environment) {
        brandScore.dimensions.environment_count++;
        if (envContrib < brandScore.dimensions.environment_worst) {
          brandScore.dimensions.environment_worst = envContrib;
        } else if (envContrib > 0 && envContrib > brandScore.dimensions.environment_worst) {
          brandScore.dimensions.environment_worst = envContrib;
        }
      }
      if (impacts.politics) {
        brandScore.dimensions.politics_count++;
        if (politicsContrib < brandScore.dimensions.politics_worst) {
          brandScore.dimensions.politics_worst = politicsContrib;
        } else if (politicsContrib > 0 && politicsContrib > brandScore.dimensions.politics_worst) {
          brandScore.dimensions.politics_worst = politicsContrib;
        }
      }
      if (impacts.social) {
        brandScore.dimensions.social_count++;
        if (socialContrib < brandScore.dimensions.social_worst) {
          brandScore.dimensions.social_worst = socialContrib;
        } else if (socialContrib > 0 && socialContrib > brandScore.dimensions.social_worst) {
          brandScore.dimensions.social_worst = socialContrib;
        }
      }
      
      brandScore.event_count += 1;
      
      const daysSince = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince <= 30) {
        brandScore.recent_events += 1;
      }

      // Add per-event details for transparency
      const bestSource = bestSourceByEvent.get(event.event_id);
      brandScore.per_event.push({
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
        impacts: impacts,
        contrib: {
          labor: Math.round(laborContrib * 1000) / 1000,
          environment: Math.round(envContrib * 1000) / 1000,
          politics: Math.round(politicsContrib * 1000) / 1000,
          social: Math.round(socialContrib * 1000) / 1000,
        },
      });
    }

    console.log(`Events with impacts: ${eventsWithImpacts}, without: ${eventsWithoutImpacts}, tier3 skipped: ${eventsSkippedTier3}`);
    console.log(`Computed dimension sums for ${brandScoresMap.size} brands`);

    // Upsert scores into brand_scores table + write audit trail
    let updatedCount = 0;
    for (const [brandId, brandData] of brandScoresMap) {
      // Compute per-dimension scores (0-100) with normalization by event count + severity spike guard
      const rawScoreLabor = computeDimensionScore(brandData.dimensions.labor_sum, brandData.dimensions.labor_count, brandData.dimensions.labor_worst);
      const rawScoreEnv = computeDimensionScore(brandData.dimensions.environment_sum, brandData.dimensions.environment_count, brandData.dimensions.environment_worst);
      const rawScorePolitics = computeDimensionScore(brandData.dimensions.politics_sum, brandData.dimensions.politics_count, brandData.dimensions.politics_worst);
      const rawScoreSocial = computeDimensionScore(brandData.dimensions.social_sum, brandData.dimensions.social_count, brandData.dimensions.social_worst);
      
      // Apply soft floor guards to prevent single-event extremes
      const scoreLabor = applyScoreFloor(rawScoreLabor, brandData.dimensions.labor_count);
      const scoreEnv = applyScoreFloor(rawScoreEnv, brandData.dimensions.environment_count);
      const scorePolitics = applyScoreFloor(rawScorePolitics, brandData.dimensions.politics_count);
      const scoreSocial = applyScoreFloor(rawScoreSocial, brandData.dimensions.social_count);
      
      // Overall score is weighted average of dimensions with data
      const totalDimEvents = 
        brandData.dimensions.labor_count + 
        brandData.dimensions.environment_count + 
        brandData.dimensions.politics_count + 
        brandData.dimensions.social_count;
      
      let overallScore: number;
      if (totalDimEvents > 0) {
        overallScore = Math.round(
          (scoreLabor * brandData.dimensions.labor_count +
           scoreEnv * brandData.dimensions.environment_count +
           scorePolitics * brandData.dimensions.politics_count +
           scoreSocial * brandData.dimensions.social_count) / totalDimEvents
        );
      } else {
        overallScore = Math.round((scoreLabor + scoreEnv + scorePolitics + scoreSocial) / 4);
      }

      // --- AUDIT TRAIL: Write per-event weights back to brand_events ---
      for (const pe of brandData.per_event) {
        const totalContrib = pe.contrib.labor + pe.contrib.environment + pe.contrib.politics + pe.contrib.social;
        try {
          await supabase
            .from('brand_events')
            .update({
              decay_multiplier: pe.w_recency,
              weighted_impact_score: Math.round(totalContrib * 1000) / 1000,
              community_multiplier: pe.w_comm ?? 1.0,
            })
            .eq('event_id', pe.event_id);
        } catch (e) {
          // Non-fatal: don't stop score computation for audit writes
        }
      }

      // --- AUDIT TRAIL: Fetch previous score for delta ---
      let previousScore: number | null = null;
      try {
        const { data: prevData } = await supabase
          .from('brand_scores')
          .select('score')
          .eq('brand_id', brandId)
          .maybeSingle();
        if (prevData?.score != null) {
          const parsed = typeof prevData.score === 'string' ? JSON.parse(prevData.score) : prevData.score;
          previousScore = parsed?.overall ?? null;
        }
      } catch {}

      // Find top positive and negative events
      let topPositiveId: string | null = null;
      let topNegativeId: string | null = null;
      let maxPositive = 0;
      let maxNegative = 0;
      for (const pe of brandData.per_event) {
        const total = pe.contrib.labor + pe.contrib.environment + pe.contrib.politics + pe.contrib.social;
        if (total > maxPositive) { maxPositive = total; topPositiveId = pe.event_id; }
        if (total < maxNegative) { maxNegative = total; topNegativeId = pe.event_id; }
      }

      // Date range
      const dates = brandData.per_event.map(pe => new Date(pe.date).getTime()).filter(d => !isNaN(d));
      const dateStart = dates.length > 0 ? new Date(Math.min(...dates)).toISOString().split('T')[0] : null;
      const dateEnd = dates.length > 0 ? new Date(Math.max(...dates)).toISOString().split('T')[0] : null;

      // Events that actually moved score (non-zero contrib)
      const eventsThatMoved = brandData.per_event.filter(pe => {
        const total = pe.contrib.labor + pe.contrib.environment + pe.contrib.politics + pe.contrib.social;
        return Math.abs(total) > 0.01;
      }).length;

      // --- AUDIT TRAIL: Write audit row ---
      try {
        await supabase.from('brand_score_audit').insert({
          brand_id: brandId,
          classifier_version: 'v2-llm-classify',
          score_labor: scoreLabor,
          score_environment: scoreEnv,
          score_social: scoreSocial,
          score_politics: scorePolitics,
          score_overall: overallScore,
          previous_score_overall: previousScore != null ? Math.round(previousScore) : null,
          score_delta: previousScore != null ? overallScore - Math.round(previousScore) : null,
          events_considered: events.length,
          events_after_dedup: dedupedEvents.length,
          events_after_cap: cappedEvents.length,
          events_that_moved_score: eventsThatMoved,
          date_range_start: dateStart,
          date_range_end: dateEnd,
          top_positive_event_id: topPositiveId,
          top_negative_event_id: topNegativeId,
        });
      } catch (auditErr) {
        console.error(`[Audit] Failed to write audit for ${brandId}:`, auditErr);
      }
      
      const reasonJson = {
        version: 2,
        window: {
          from: 'all-time',
          to: now.toISOString().split('T')[0],
        },
        coeffs: {
          recency: RECENCY_WEIGHTS,
          verification: VERIFICATION_WEIGHTS,
        },
        dimension_sums: {
          labor: Math.round(brandData.dimensions.labor_sum * 1000) / 1000,
          environment: Math.round(brandData.dimensions.environment_sum * 1000) / 1000,
          politics: Math.round(brandData.dimensions.politics_sum * 1000) / 1000,
          social: Math.round(brandData.dimensions.social_sum * 1000) / 1000,
        },
        dimension_counts: {
          labor: brandData.dimensions.labor_count,
          environment: brandData.dimensions.environment_count,
          politics: brandData.dimensions.politics_count,
          social: brandData.dimensions.social_count,
        },
        scores: {
          labor: scoreLabor,
          environment: scoreEnv,
          politics: scorePolitics,
          social: scoreSocial,
          overall: overallScore,
        },
        event_count: brandData.event_count,
        recent_events_30d: brandData.recent_events,
        computed_at: now.toISOString(),
        per_event: brandData.per_event.slice(0, 50),
      };

      const { error: upsertError } = await supabase
        .from('brand_scores')
        .upsert({
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
        }, {
          onConflict: 'brand_id',
        });

      if (upsertError) {
        console.error(`Failed to upsert score for brand ${brandId}:`, upsertError);
      } else {
        updatedCount++;
      }
    }

    console.log(`Updated scores for ${updatedCount} brands`);

    // Refresh brand_data_coverage using RPC
    console.log('Refreshing brand coverage data...');
    const { error: refreshError } = await supabase.rpc('refresh_brand_coverage');
    
    if (refreshError) {
      console.error('Failed to refresh coverage:', refreshError);
    } else {
      console.log('Coverage data refreshed successfully');
    }

    // Log successful completion
    if (runId) {
      await supabase
        .from('score_runs')
        .update({
          status: 'ok',
          finished_at: new Date().toISOString(),
          events_count: events.length,
          brands_updated: updatedCount,
          details: { 
            message: 'Success (v2 per-dimension)',
            events_with_impacts: eventsWithImpacts,
            events_without_impacts: eventsWithoutImpacts,
          }
        })
        .eq('id', runId);
    }

    return new Response(
      JSON.stringify({
        message: 'Brand scores recomputed successfully (v2 per-dimension)',
        brands_updated: updatedCount,
        events_processed: events.length,
        events_with_impacts: eventsWithImpacts,
        events_without_impacts: eventsWithoutImpacts,
        timestamp: now.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Recompute error:', error);
    
    // Log error if we have a runId
    if (runId) {
      try {
        await supabase
          .from('score_runs')
          .update({
            status: 'error',
            finished_at: new Date().toISOString(),
            details: { error: errorMessage }
          })
          .eq('id', runId);
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
    }
    
    return new Response(
      JSON.stringify({ error: 'Failed to recompute scores', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
