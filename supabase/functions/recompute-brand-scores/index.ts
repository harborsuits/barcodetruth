// TICKET D: Nightly brand score recomputation
// Calculates brand scores from last 365 days of events with recency & verification weights
// FIXED: Now reads all 4 category impacts and computes per-dimension scores
// ADDED: Title-similarity deduplication to prevent multiple articles about same event counting multiple times
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { compareTwoStrings } from 'https://esm.sh/string-similarity@4.0.4';
import { corsHeaders } from '../_shared/cors.ts';

const RECENCY_WEIGHTS = {
  '0-30': 1.0,
  '31-90': 0.7,
  '91-365': 0.4,
};

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
  return 0;
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
// Base of 50, adjusted by weighted impact sums
// Each impact point shifts score by 5 points (so ±10 impact = ±50 score shift)
function computeDimensionScore(sum: number): number {
  // Scale factor: how much each weighted impact point affects the score
  const SCALE = 5;
  const score = 50 + (sum * SCALE);
  return Math.max(0, Math.min(100, Math.round(score)));
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
    const oneYearAgo = new Date(now);
    oneYearAgo.setDate(now.getDate() - 365);

    // Fetch all events from last 365 days WITH category_impacts
    // Uses brand_events_with_inheritance to include parent company events for subsidiaries
    const { data: events, error: eventsError } = await supabase
      .from('brand_events_with_inheritance')
      .select('event_id, brand_id, title, event_date, verification, category_impacts, category, credibility, inherited_from_parent, parent_brand_name, scope_multiplier')
      .gte('event_date', oneYearAgo.toISOString())
      .order('event_date', { ascending: false });

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

    // Fetch best source per event (prefer official, then earliest)
    const eventIds = dedupedEvents.map((e: BrandEvent) => e.event_id);
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

    for (const event of dedupedEvents) {
      const eventDate = new Date(event.event_date);
      const recencyWeight = getRecencyWeight(eventDate, now);
      const verificationWeight = getVerificationWeight(event.verification);
      const credibilityWeight = event.credibility ?? 0.6;
      
      // Read category_impacts - THE KEY FIX
      const impacts: CategoryImpacts = event.category_impacts || {};
      
      // Check if this event has meaningful impacts
      const hasImpacts = Object.values(impacts).some(v => v !== 0 && v !== undefined);
      if (hasImpacts) {
        eventsWithImpacts++;
      } else {
        eventsWithoutImpacts++;
      }
      
      // Combined weight for this event
      const combinedWeight = recencyWeight * verificationWeight * credibilityWeight;
      
      // Get scope multiplier (1.0 for direct events, 0.7 for inherited from parent)
      const scopeMultiplier = (event as BrandEvent).scope_multiplier ?? 1.0;
      
      // Calculate weighted contribution per dimension WITH scope multiplier
      const laborContrib = (impacts.labor || 0) * combinedWeight * scopeMultiplier;
      const envContrib = (impacts.environment || 0) * combinedWeight * scopeMultiplier;
      const politicsContrib = (impacts.politics || 0) * combinedWeight * scopeMultiplier;
      const socialContrib = (impacts.social || 0) * combinedWeight * scopeMultiplier;

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
      if (impacts.labor) brandScore.dimensions.labor_count++;
      if (impacts.environment) brandScore.dimensions.environment_count++;
      if (impacts.politics) brandScore.dimensions.politics_count++;
      if (impacts.social) brandScore.dimensions.social_count++;
      
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

    console.log(`Events with impacts: ${eventsWithImpacts}, without: ${eventsWithoutImpacts}`);
    console.log(`Computed dimension sums for ${brandScoresMap.size} brands`);

    // Upsert scores into brand_scores table
    let updatedCount = 0;
    for (const [brandId, brandData] of brandScoresMap) {
      // Compute per-dimension scores (0-100)
      const scoreLabor = computeDimensionScore(brandData.dimensions.labor_sum);
      const scoreEnv = computeDimensionScore(brandData.dimensions.environment_sum);
      const scorePolitics = computeDimensionScore(brandData.dimensions.politics_sum);
      const scoreSocial = computeDimensionScore(brandData.dimensions.social_sum);
      
      // Overall score is weighted average of dimensions with data
      // Weight dimensions by how many events affected them
      const totalDimEvents = 
        brandData.dimensions.labor_count + 
        brandData.dimensions.environment_count + 
        brandData.dimensions.politics_count + 
        brandData.dimensions.social_count;
      
      let overallScore: number;
      if (totalDimEvents > 0) {
        // Weighted average by dimension event count
        overallScore = Math.round(
          (scoreLabor * brandData.dimensions.labor_count +
           scoreEnv * brandData.dimensions.environment_count +
           scorePolitics * brandData.dimensions.politics_count +
           scoreSocial * brandData.dimensions.social_count) / totalDimEvents
        );
      } else {
        // No dimensional impacts - use simple average
        overallScore = Math.round((scoreLabor + scoreEnv + scorePolitics + scoreSocial) / 4);
      }
      
      const reasonJson = {
        version: 2,
        window: {
          from: oneYearAgo.toISOString().split('T')[0],
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
        per_event: brandData.per_event.slice(0, 50), // Limit to 50 most recent for storage
      };

      const { error: upsertError } = await supabase
        .from('brand_scores')
        .upsert({
          brand_id: brandId,
          // Canonical fields for UI/RPC
          score: overallScore,
          updated_at: now.toISOString(),
          reason_json: reasonJson,
          // Per-dimension scores - NOW DIFFERENTIATED
          score_labor: scoreLabor,
          score_environment: scoreEnv,
          score_politics: scorePolitics,
          score_social: scoreSocial,
          // Legacy fields
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
