import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScoreRequest {
  brand_id: string;
}

interface Weights {
  labor: number;
  environment: number;
  politics: number;
  social: number;
}

// Apply event impact to slider scores with verification factor
function applyEventImpact(
  baseScores: Weights,
  eventImpact: Partial<Weights>,
  verification: 'unverified' | 'corroborated' | 'official',
  sourceCount: number
): Weights {
  // Verification factors
  const factor = 
    verification === 'official' ? 1.0 :
    verification === 'corroborated' ? 0.75 :
    sourceCount === 1 ? 0.0 : // Single unverified source = no impact
    0.25; // Multiple unverified sources = 25% impact

  const next = { ...baseScores };
  
  for (const key of ['labor', 'environment', 'politics', 'social'] as const) {
    const delta = (eventImpact[key] ?? 0) * factor;
    // Cap per-event absolute impact to ±20 points
    const cappedDelta = Math.max(-20, Math.min(20, delta));
    next[key] = Math.max(0, Math.min(100, next[key] + cappedDelta));
  }
  
  return next;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { brand_id } = await req.json() as ScoreRequest;

    // Start with base scores (50/50/50/50)
    let scores: Weights = {
      labor: 50,
      environment: 50,
      politics: 50,
      social: 50,
    };

    // Fetch recent events (last 90 days) with sources
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: events, error: eventsError } = await supabase
      .from('brand_events')
      .select(`
        event_id,
        verification,
        impact_labor,
        impact_environment,
        impact_politics,
        impact_social,
        event_sources (*)
      `)
      .eq('brand_id', brand_id)
      .gte('event_date', ninetyDaysAgo)
      .order('event_date', { ascending: true });

    if (eventsError) throw eventsError;

    // Apply each event's impact
    let totalAbsChange = 0;
    
    for (const event of events || []) {
      const eventImpact: Partial<Weights> = {
        labor: event.impact_labor ?? undefined,
        environment: event.impact_environment ?? undefined,
        politics: event.impact_politics ?? undefined,
        social: event.impact_social ?? undefined,
      };

      const sourceCount = event.event_sources?.length || 0;
      const oldScores = { ...scores };
      
      scores = applyEventImpact(
        scores, 
        eventImpact, 
        event.verification || 'unverified',
        sourceCount
      );

      // Track total absolute change (for 35-point cap)
      totalAbsChange += Math.abs(scores.labor - oldScores.labor) +
                       Math.abs(scores.environment - oldScores.environment) +
                       Math.abs(scores.politics - oldScores.politics) +
                       Math.abs(scores.social - oldScores.social);

      // Cap total 90-day change at 35 points per slider
      if (totalAbsChange > 140) { // 35 * 4 sliders
        console.warn('90-day change cap reached for brand', brand_id);
        break;
      }
    }

    // Upsert brand scores
    const { error: upsertError } = await supabase
      .from('brand_scores')
      .upsert({
        brand_id,
        score_labor: Math.round(scores.labor),
        score_environment: Math.round(scores.environment),
        score_politics: Math.round(scores.politics),
        score_social: Math.round(scores.social),
      }, { onConflict: 'brand_id' });

    if (upsertError) throw upsertError;

    console.log('Calculated scores for brand', brand_id, scores);

    return new Response(
      JSON.stringify({ success: true, scores }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Score calculation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
