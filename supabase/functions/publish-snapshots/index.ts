import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { requireInternal } from '../_shared/internal.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const guard = requireInternal(req);
  if (guard) return guard;
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
      .in('verification', ['corroborated', 'official'])
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

    // Upload to storage
    const version = Date.now().toString();
    
    const trendingBlob = new Blob(
      [JSON.stringify(trendingSnapshot)],
      { type: 'application/json' }
    );

    const { error: uploadError } = await supabase.storage
      .from('snapshots')
      .upload(`v/${version}/trending.json`, trendingBlob, {
        contentType: 'application/json',
        cacheControl: '900', // 15 minutes
        upsert: true,
      });

    if (uploadError) {
      console.error(`[${requestId}] Upload error:`, uploadError);
      throw uploadError;
    }

    // Update latest.json pointer
    const latestBlob = new Blob(
      [JSON.stringify({ version, generated_at: new Date().toISOString() })],
      { type: 'application/json' }
    );

    await supabase.storage
      .from('snapshots')
      .upload('latest.json', latestBlob, {
        contentType: 'application/json',
        cacheControl: '60', // 1 minute
        upsert: true,
      });

    console.log(`[${requestId}] Built trending snapshot: ${trendingSnapshot.count} events (v${version})`);

    // Build per-brand snapshots for brands with recent activity
    const { data: activeBrands, error: brandsError } = await supabase
      .from('brand_scores')
      .select('brand_id')
      .gte('last_updated', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (brandsError) {
      console.error(`[${requestId}] Error fetching active brands:`, brandsError);
      throw brandsError;
    }

    let brandSnapshotsCount = 0;

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
        .maybeSingle();

      if (!brandError && brandData) {
        const brandSnapshot = {
          generated_at: new Date().toISOString(),
          brand: brandData,
        };

        const brandBlob = new Blob(
          [JSON.stringify(brandSnapshot)],
          { type: 'application/json' }
        );

        await supabase.storage
          .from('snapshots')
          .upload(`v/${version}/brand_${brand.brand_id}.json`, brandBlob, {
            contentType: 'application/json',
            cacheControl: '900',
            upsert: true,
          });

        brandSnapshotsCount++;
      }
    }

    console.log(`[${requestId}] Built ${brandSnapshotsCount} brand snapshots`);

    const result = {
      success: true,
      generated_at: new Date().toISOString(),
      version,
      snapshots: {
        trending: trendingSnapshot.count,
        brands: brandSnapshotsCount,
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
