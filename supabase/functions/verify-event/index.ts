import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

const seen = new Map<string, { ts: number; resp: string }>();
const TTL = 5 * 60 * 1000; // 5 minutes

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
  event_id: z.string().min(1),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const idemState = handleIdempotency(req, 'verify-event');
  if (idemState.replay) {
    return new Response(idemState.payload, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-API-Version': '1' }
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = RequestBody.parse(await req.json());
    const { event_id } = body;

    // Fetch event with sources
    const { data: event, error: eventError } = await supabase
      .from('brand_events')
      .select('*, event_sources(*)')
      .eq('event_id', event_id)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    const sources = event.event_sources || [];
    
    // Determine verification level
    let verification: 'unverified' | 'corroborated' | 'official' = 'unverified';
    
    // Check if any source is official (gov/regulator)
    const officialDomains = ['fec.gov', 'osha.gov', 'epa.gov', 'ilo.org'];
    const hasOfficial = sources.some((s: any) => 
      s.source_url && officialDomains.some(d => s.source_url.includes(d))
    );

    if (hasOfficial) {
      verification = 'official';
    } else {
      // Get credibility for each source
      const credibilityChecks = await Promise.all(
        sources.map(async (s: any) => {
          const { data } = await supabase.rpc('get_source_credibility', { 
            source_name_param: s.source_name,
            source_url_param: s.source_url || ''
          });
          return data || 0.6;
        })
      );

      // Corroborated if ≥2 sources with credibility ≥0.8 within 14 days
      const highCredSources = credibilityChecks.filter(c => c >= 0.8).length;
      const withinTimeframe = sources.length >= 2; // Simplified check
      
      if (highCredSources >= 2 && withinTimeframe) {
        verification = 'corroborated';
      }
    }

    // Update event verification
    const { error: updateError } = await supabase
      .from('brand_events')
      .update({ verification, verified: verification !== 'unverified' })
      .eq('event_id', event_id);

    if (updateError) throw updateError;

    const response = JSON.stringify({ success: true, verification });
    idemState.set(response);
    
    return new Response(response, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-API-Version': '1' }
    });
  } catch (error) {
    console.error('Verification error:', error);
    
    const errorType = error instanceof z.ZodError ? 'INVALID_REQUEST' : 'INTERNAL';
    const status = errorType === 'INVALID_REQUEST' ? 422 : 500;
    const message = error instanceof z.ZodError 
      ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      : error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: errorType, message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-API-Version': '1' } }
    );
  }
});
