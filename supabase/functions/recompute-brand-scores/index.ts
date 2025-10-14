// TICKET D: Nightly brand score recomputation
// Calculates brand scores from last 365 days of events with recency & verification weights
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

interface BrandEvent {
  brand_id: string;
  event_date: string;
  verification: 'official' | 'corroborated' | 'unverified';
  impact_labor: number | null;
  category: string;
}

interface BrandScore {
  brand_id: string;
  raw_sum: number;
  event_count: number;
  recent_events: number;
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

function normalizeScores(brandScores: BrandScore[]): Map<string, number> {
  if (brandScores.length === 0) return new Map();
  
  const rawValues = brandScores.map(b => b.raw_sum);
  const minVal = Math.min(...rawValues);
  const maxVal = Math.max(...rawValues);
  const range = maxVal - minVal;
  
  const normalized = new Map<string, number>();
  
  for (const brand of brandScores) {
    // Min-max normalization to 0-100 scale
    // Add small epsilon to avoid division by zero
    const score = range > 0.01 
      ? Math.round(((brand.raw_sum - minVal) / range) * 100)
      : 50; // Default to middle if no variance
    
    normalized.set(brand.brand_id, Math.max(0, Math.min(100, score)));
  }
  
  return normalized;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Protect endpoint with cron key
  const CRON_KEY = Deno.env.get('CRON_KEY');
  const providedKey = req.headers.get('x-cron-key');
  
  if (!CRON_KEY || providedKey !== CRON_KEY) {
    console.error('Unauthorized: missing or invalid x-cron-key');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  let runId: string | undefined;

  try {
    console.log('Starting brand score recomputation...');
    
    // Log run start
    const { data: runRecord, error: runError } = await supabase
      .from('score_runs')
      .insert({ status: 'running' })
      .select('id')
      .single();
    
    runId = runRecord?.id;
    
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setDate(now.getDate() - 365);

    // Fetch all events from last 365 days
    const { data: events, error: eventsError } = await supabase
      .from('brand_events')
      .select('brand_id, event_date, verification, impact_labor, category')
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

    // Group events by brand and compute raw scores
    const brandScoresMap = new Map<string, BrandScore>();

    for (const event of events as BrandEvent[]) {
      const eventDate = new Date(event.event_date);
      const recencyWeight = getRecencyWeight(eventDate, now);
      const verificationWeight = getVerificationWeight(event.verification);
      
      // Use impact_labor as base signal (fallback to 1 if null)
      const eventImpact = Math.abs(event.impact_labor ?? 1);
      
      // Combined weight
      const weightedImpact = recencyWeight * verificationWeight * eventImpact;

      if (!brandScoresMap.has(event.brand_id)) {
        brandScoresMap.set(event.brand_id, {
          brand_id: event.brand_id,
          raw_sum: 0,
          event_count: 0,
          recent_events: 0,
        });
      }

      const brandScore = brandScoresMap.get(event.brand_id)!;
      brandScore.raw_sum += weightedImpact;
      brandScore.event_count += 1;
      
      const daysSince = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince <= 30) {
        brandScore.recent_events += 1;
      }
    }

    const brandScores = Array.from(brandScoresMap.values());
    console.log(`Computed raw scores for ${brandScores.length} brands`);

    // Normalize scores to 0-100
    const normalizedScores = normalizeScores(brandScores);

    // Upsert scores into brand_scores table
    let updatedCount = 0;
    for (const [brandId, score] of normalizedScores) {
      const brandData = brandScoresMap.get(brandId)!;
      
      const reasonJson = {
        recency_weights: RECENCY_WEIGHTS,
        verification_weights: VERIFICATION_WEIGHTS,
        raw_sum: Math.round(brandData.raw_sum * 100) / 100,
        normalized: score,
        event_count: brandData.event_count,
        recent_events: brandData.recent_events,
        computed_at: now.toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('brand_scores')
        .upsert({
          brand_id: brandId,
          // Canonical fields for UI/RPC
          score: score,
          updated_at: now.toISOString(),
          reason_json: reasonJson,
          // Legacy fields (kept for compatibility)
          score_labor: score,
          score_environment: score,
          score_politics: score,
          score_social: score,
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
          details: { message: 'Success' }
        })
        .eq('id', runId);
    }

    return new Response(
      JSON.stringify({
        message: 'Brand scores recomputed successfully',
        brands_updated: updatedCount,
        events_processed: events.length,
        timestamp: now.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Recompute error:', error);
    
    // Log error if we have a runId
    if (runId) {
      try {
        await supabase
          .from('score_runs')
          .update({
            status: 'error',
            finished_at: new Date().toISOString(),
            details: { error: error?.message ?? 'Unknown error' }
          })
          .eq('id', runId);
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
    }
    
    return new Response(
      JSON.stringify({ error: 'Failed to recompute scores', message: error?.message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
