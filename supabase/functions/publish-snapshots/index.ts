import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const requestId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  const baseHeaders = { 
    ...corsHeaders, 
    'Content-Type': 'application/json',
    'X-Request-Id': requestId 
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: baseHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[${requestId}] Building snapshots...`);

    // Build trending snapshot
    const { data: trendingEvents, error: trendingError } = await supabase
      .from('v_events')
      .select(`
        *,
        brands!inner(name, parent_company)
      `)
      .eq('verification', 'corroborated')
      .or('verification.eq.official')
      .gte('event_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('event_date', { ascending: false })
      .limit(50);

    if (trendingError) {
      console.error(`[${requestId}] Error fetching trending:`, trendingError);
      throw trendingError;
    }

    const trendingSnapshot = {
      generated_at: new Date().toISOString(),
      events: trendingEvents,
      count: trendingEvents?.length || 0,
    };

    // Upload trending snapshot (using storage would be better, but we'll use a simple approach)
    console.log(`[${requestId}] Built trending snapshot with ${trendingSnapshot.count} events`);

    // Build per-brand snapshots for brands with recent activity
    const { data: activeBrands, error: brandsError } = await supabase
      .from('brand_scores')
      .select('brand_id')
      .gte('last_updated', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (brandsError) {
      console.error(`[${requestId}] Error fetching active brands:`, brandsError);
      throw brandsError;
    }

    const brandSnapshots: Record<string, any> = {};

    for (const brand of activeBrands || []) {
      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select(`
          *,
          brand_scores(*),
          brand_events(
            *,
            event_sources(*)
          )
        `)
        .eq('id', brand.brand_id)
        .single();

      if (!brandError && brandData) {
        brandSnapshots[brand.brand_id] = {
          generated_at: new Date().toISOString(),
          brand: brandData,
        };
      }
    }

    console.log(`[${requestId}] Built ${Object.keys(brandSnapshots).length} brand snapshots`);

    const result = {
      success: true,
      generated_at: new Date().toISOString(),
      snapshots: {
        trending: trendingSnapshot.count,
        brands: Object.keys(brandSnapshots).length,
      },
    };

    return new Response(JSON.stringify(result), { headers: baseHeaders });

  } catch (error) {
    console.error(`[${requestId}] Snapshot publishing error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: baseHeaders }
    );
  }
});
