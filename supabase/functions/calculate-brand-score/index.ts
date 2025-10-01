import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

const seen = new Map<string, { ts: number; resp: string }>();
const TTL = 5 * 60 * 1000;

function handleIdempotency(req: Request, scope: string) {
  const key = req.headers.get('Idempotency-Key');
  if (!key) return { replay: false, set: (_: string) => {} };
  const k = `${scope}:${key}`;
  const hit = seen.get(k);
  const now = Date.now();
  if (hit && (now - hit.ts) < TTL) return { replay: true, payload: hit.resp, set: (_: string) => {} };
  return { replay: false, set: (resp: string) => seen.set(k, { ts: now, resp }) };
}

const RequestBody = z.object({
  brand_id: z.string().min(1),
});

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
  const requestId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  const baseHeaders = { 
    ...corsHeaders, 
    'Content-Type': 'application/json', 
    'X-API-Version': '1',
    'X-Request-Id': requestId 
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: baseHeaders });
  }

  const idemState = handleIdempotency(req, 'calculate-brand-score');
  if (idemState.replay) {
    return new Response(idemState.payload, { headers: baseHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = RequestBody.parse(await req.json());
    const { brand_id } = body;
    
    console.log(`[${requestId}] Calculating scores for brand:`, brand_id);

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

    // Fetch previous scores for delta detection
    const { data: prevScores } = await supabase
      .from('brand_scores')
      .select('score_labor, score_environment, score_politics, score_social')
      .eq('brand_id', brand_id)
      .single();

    const { data: brandData } = await supabase
      .from('brands')
      .select('name')
      .eq('id', brand_id)
      .single();

    const newScores = {
      score_labor: Math.round(scores.labor),
      score_environment: Math.round(scores.environment),
      score_politics: Math.round(scores.politics),
      score_social: Math.round(scores.social),
    };

    // Upsert brand scores
    const { error: upsertError } = await supabase
      .from('brand_scores')
      .upsert({
        brand_id,
        ...newScores,
      }, { onConflict: 'brand_id' });

    if (upsertError) throw upsertError;

    // Detect deltas and queue push notifications for changes ≥5
    if (prevScores) {
      type Slider = 'labor' | 'environment' | 'politics' | 'social';
      const sliders: Slider[] = ['labor', 'environment', 'politics', 'social'];
      
      const delta = (a: number | null | undefined, b: number | null | undefined) => {
        if (a == null || b == null) return 0;
        return Math.round(b - a);
      };

      const changes = sliders
        .map((s) => ({ 
          category: s, 
          delta: delta(
            prevScores[`score_${s}` as keyof typeof prevScores], 
            newScores[`score_${s}` as keyof typeof newScores]
          ) 
        }))
        .filter(({ delta }) => Math.abs(delta) >= 5);

      // Queue push notification jobs for significant changes
      for (const { category, delta: deltaValue } of changes) {
        await supabase.from('jobs').insert({
          stage: 'send_push_for_score_change',
          payload: {
            brand_id,
            brand_name: brandData?.name ?? brand_id,
            category,
            delta: deltaValue,
            at: new Date().toISOString(),
          },
          not_before: new Date().toISOString(),
        });
        
        console.log(`[${requestId}] Queued push notification: ${brandData?.name ?? brand_id} ${category} ${deltaValue > 0 ? '+' : ''}${deltaValue}`);
      }
    }

    const response = JSON.stringify({ success: true, scores });
    idemState.set(response);
    
    console.log(`[${requestId}] Calculated scores for brand ${brand_id}:`, scores);
    return new Response(response, { headers: baseHeaders });
    
  } catch (error) {
    console.error(`[${requestId}] Score calculation error:`, error);
    
    const errorType = error instanceof z.ZodError ? 'INVALID_REQUEST' : 'INTERNAL';
    const status = errorType === 'INVALID_REQUEST' ? 422 : 500;
    const message = error instanceof z.ZodError 
      ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      : error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: errorType, message }),
      { status, headers: baseHeaders }
    );
  }
});
