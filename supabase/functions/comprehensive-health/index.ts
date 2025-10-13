import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthMetrics {
  evidence_recent: boolean;
  match_rate_ok: boolean;
  scores_fresh: boolean;
  homepage_ok: boolean;
  details: {
    rss_items_2h: number;
    rss_matched_2h: number;
    match_rate_pct: number;
    scores_updated_24h: number;
    homepage_pending: number;
    products_with_brands: number;
    total_products: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Run health checks
    const metrics: HealthMetrics = {
      evidence_recent: false,
      match_rate_ok: false,
      scores_fresh: false,
      homepage_ok: false,
      details: {
        rss_items_2h: 0,
        rss_matched_2h: 0,
        match_rate_pct: 0,
        scores_updated_24h: 0,
        homepage_pending: 0,
        products_with_brands: 0,
        total_products: 0,
      }
    };

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Pipeline recency - RSS items
    const { count: rssItems2h } = await supabaseClient
      .from('rss_items')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twoHoursAgo);

    const { count: rssMatched2h } = await supabaseClient
      .from('rss_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'matched')
      .gte('created_at', twoHoursAgo);

    const { count: eventSources2h } = await supabaseClient
      .from('event_sources')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twoHoursAgo);

    metrics.details.rss_items_2h = rssItems2h || 0;
    metrics.details.rss_matched_2h = rssMatched2h || 0;
    metrics.evidence_recent = (eventSources2h || 0) > 0;

    // 2. Match rate (last 24h)
    const { count: totalRss24h } = await supabaseClient
      .from('rss_items')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    const { count: matchedRss24h } = await supabaseClient
      .from('rss_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'matched')
      .gte('created_at', twentyFourHoursAgo);

    const matchRatePct = totalRss24h && totalRss24h > 0 
      ? Math.round((matchedRss24h || 0) * 100 / totalRss24h * 10) / 10
      : 0;

    metrics.details.match_rate_pct = matchRatePct;
    metrics.match_rate_ok = matchRatePct >= 5;

    // 3. Score freshness
    const { count: scoresUpdated24h } = await supabaseClient
      .from('brand_scores')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', twentyFourHoursAgo);

    metrics.details.scores_updated_24h = scoresUpdated24h || 0;
    metrics.scores_fresh = (scoresUpdated24h || 0) > 0;

    // 4. Homepage backlog
    const { count: homepagePending } = await supabaseClient
      .from('event_sources')
      .select('*', { count: 'exact', head: true })
      .eq('link_kind', 'homepage')
      .gte('created_at', thirtyDaysAgo);

    metrics.details.homepage_pending = homepagePending || 0;
    metrics.homepage_ok = (homepagePending || 0) < 200;

    // 5. Scanner readiness
    const { count: totalProducts } = await supabaseClient
      .from('products')
      .select('*', { count: 'exact', head: true });

    const { count: productsWithBrands } = await supabaseClient
      .from('products')
      .select('*', { count: 'exact', head: true })
      .not('brand_id', 'is', null);

    metrics.details.total_products = totalProducts || 0;
    metrics.details.products_with_brands = productsWithBrands || 0;

    return new Response(JSON.stringify(metrics), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in comprehensive-health:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
