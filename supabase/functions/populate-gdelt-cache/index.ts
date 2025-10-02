import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

// Winsorized median calculation
function winsorizedMedian(nums: number[], p = 0.05): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a: number, b: number) => a - b);
  const lo = Math.floor(p * s.length);
  const hi = Math.ceil((1 - p) * s.length) - 1;
  const clipped = s.slice(lo, hi + 1);
  return clipped[Math.floor(clipped.length / 2)] ?? 0;
}

// GDELT tone fetcher (same as in calculate-brand-score)
async function fetchGdeltTone(brandName: string): Promise<{ medianTone: number; docCount: number }> {
  try {
    const q = `"${brandName}" sourcelang:english`;
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&timespan=24m&mode=ArtList&format=json&maxrecords=250`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.warn(`[GDELT] fetch failed for ${brandName}: ${res.status}`);
      return { medianTone: 0, docCount: 0 };
    }
    const data = await res.json();
    if (!data.articles || !Array.isArray(data.articles)) {
      return { medianTone: 0, docCount: 0 };
    }
    const tones = data.articles
      .map((a: any) => Number(a.tone))
      .filter((t: number) => !isNaN(t) && isFinite(t));
    
    if (tones.length < 30) {
      return { medianTone: 0, docCount: tones.length };
    }
    
    const median = winsorizedMedian(tones, 0.05);
    return { medianTone: median, docCount: tones.length };
  } catch (e) {
    console.error(`[GDELT] error for ${brandName}:`, e);
    return { medianTone: 0, docCount: 0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') ?? '200');
    const staleHours = Number(url.searchParams.get('stale_hours') ?? '24');
    const dryrun = url.searchParams.get('dryrun') === '1';

    console.log(`[populate-gdelt-cache] Starting, limit=${limit}, stale_hours=${staleHours}, dryrun=${dryrun}`);

    // Get top brands without recent GDELT cache (or stale cache)
    const staleThreshold = new Date();
    staleThreshold.setHours(staleThreshold.getHours() - staleHours);

    const { data: brands, error: fetchErr } = await supabase
      .from('brands')
      .select(`
        id,
        name,
        brand_social_baseline!left(fetched_at)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fetchErr) throw fetchErr;

    if (!brands || brands.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No brands to populate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter to brands without cache or stale cache
    const needsUpdate = brands.filter(b => {
      const baseline = Array.isArray(b.brand_social_baseline) ? b.brand_social_baseline[0] : b.brand_social_baseline;
      if (!baseline || !baseline.fetched_at) return true;
      const fetchedAt = new Date(baseline.fetched_at);
      return fetchedAt < staleThreshold;
    });

    console.log(`[populate-gdelt-cache] Found ${needsUpdate.length}/${brands.length} brands needing update`);

    let processed = 0;
    let cached = 0;

    if (!dryrun) {
      for (const brand of needsUpdate) {
        try {
          const { medianTone, docCount } = await fetchGdeltTone(brand.name);
          
          const { error: upsertErr } = await supabase
            .from('brand_social_baseline')
            .upsert({
              brand_id: brand.id,
              brand_name: brand.name,
              median_tone: medianTone,
              doc_count: docCount,
              fetched_at: new Date().toISOString()
            }, { onConflict: 'brand_id' });

          if (upsertErr) {
            console.error(`[populate-gdelt-cache] Upsert error for ${brand.name}:`, upsertErr);
          } else {
            cached++;
            console.log(`[populate-gdelt-cache] Cached ${brand.name}: tone=${medianTone.toFixed(2)}, docs=${docCount}`);
          }

          processed++;

          // Rate limit: 2 seconds between requests to avoid overwhelming GDELT
          if (processed < needsUpdate.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (e) {
          console.error(`[populate-gdelt-cache] Error for ${brand.name}:`, e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryrun,
        total_brands: brands.length,
        needs_update: needsUpdate.length,
        processed,
        cached,
        message: dryrun 
          ? `Would update ${needsUpdate.length} brands` 
          : `Cached ${cached}/${processed} brands`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error('[populate-gdelt-cache] error:', e);
    return new Response(
      JSON.stringify({ success: false, error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});