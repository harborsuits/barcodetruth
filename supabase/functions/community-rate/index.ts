import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RatingInput {
  category: 'labor' | 'environment' | 'politics' | 'social';
  score: number;
  evidence_event_id?: string;
  evidence_url?: string;
  context_note?: string;
}

interface RateRequest {
  brand_id: string;
  ratings: RatingInput[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check account age (must be at least 24 hours old)
    const accountAge = Date.now() - new Date(user.created_at).getTime();
    const dayInMs = 24 * 60 * 60 * 1000;
    if (accountAge < dayInMs) {
      return new Response(
        JSON.stringify({ error: 'Account must be at least 24 hours old to rate brands' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check daily rate limit (20 writes/day)
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('community_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00Z`);

    if ((count ?? 0) >= 20) {
      return new Response(
        JSON.stringify({ error: 'Daily rating limit reached (20/day)' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RateRequest = await req.json();
    const { brand_id, ratings } = body;

    if (!brand_id || !ratings || ratings.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: brand_id and ratings required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each rating
    const results = [];
    for (const rating of ratings) {
      // Validate score
      if (rating.score < 1 || rating.score > 5) {
        continue;
      }

      // Calculate trust tier and weight
      let source_trust_tier = null;
      let weight = 1.0;

      if (rating.evidence_url) {
        // Extract domain from URL (defensive parsing)
        try {
          const url = new URL(rating.evidence_url);
          const domain = url.hostname?.toLowerCase()?.replace(/^www\./, '') ?? null;
          
          if (!domain) continue;

          // Look up in source_credibility table
          const { data: credData } = await supabase
            .from('source_credibility')
            .select('base_credibility')
            .eq('source_name', domain)
            .single();

          if (credData && credData.base_credibility >= 0.6) {
            source_trust_tier = 2;
            weight = 1.25;
          } else if (credData && credData.base_credibility >= 0.5) {
            source_trust_tier = 1;
            weight = 1.1;
          }
        } catch (e) {
          console.error('Error parsing evidence URL:', e);
        }
      }

      // Get IP and UA for abuse detection
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
      const ua = req.headers.get('user-agent') || '';

      // Simple hash function
      const simpleHash = async (str: string) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
      };

      const ip_hash = ip ? await simpleHash(ip) : null;
      const ua_hash = ua ? await simpleHash(ua) : null;

      // Upsert rating
      const { error: upsertError } = await supabase
        .from('community_ratings')
        .upsert({
          brand_id,
          user_id: user.id,
          category: rating.category,
          score: rating.score,
          evidence_event_id: rating.evidence_event_id || null,
          evidence_url: rating.evidence_url || null,
          context_note: rating.context_note?.substring(0, 140) || null,
          source_trust_tier,
          weight,
          ip_hash,
          ua_hash,
        }, {
          onConflict: 'brand_id,user_id,category',
        });

      if (upsertError) {
        console.error('Error upserting rating:', upsertError);
        results.push({ category: rating.category, error: upsertError.message });
      } else {
        results.push({ category: rating.category, success: true });
      }
    }

    // Trigger materialized view refresh (async, fire-and-forget)
    void supabase.rpc('refresh_community_outlook');

    return new Response(
      JSON.stringify({ ok: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in community-rate:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
