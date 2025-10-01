import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationRequest {
  event_id: string;
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

    const { event_id } = await req.json() as VerificationRequest;

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
            source_name_param: s.source_name 
          });
          return data || 0.5;
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

    return new Response(
      JSON.stringify({ success: true, verification }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verification error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
