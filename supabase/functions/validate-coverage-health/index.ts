import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Validation edge function to check brand coverage health
 * Returns sanity checks, distribution, and anomaly detection
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[validate-coverage-health] Starting validation checks...');

    // 1. Major brands sanity check
    const { data: majorBrands, error: majorError } = await supabase
      .from('brand_score_effective_named')
      .select(`
        brand_name,
        baseline_score,
        events_90d,
        events_365d,
        verified_rate,
        independent_sources,
        confidence,
        overall_effective,
        last_event_at
      `)
      .in('brand_name', [
        'Mondelez International',
        'PepsiCo', 
        'The Coca-Cola Company',
        'Unilever',
        'Nestlé'
      ])
      .order('brand_name');

    if (majorError) throw majorError;

    // 2. Confidence distribution - fetch all and calculate in-memory
    const { data: allScores, error: scoresError } = await supabase
      .from('brand_score_effective')
      .select('confidence');

    if (scoresError) throw scoresError;

    // Calculate distribution buckets
    const buckets: { [key: number]: number } = {};
    allScores?.forEach(s => {
      const bucket = Math.min(Math.floor((s.confidence || 0) * 10), 9);
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    });

    const distribution = Object.entries(buckets).map(([bucket, count]) => ({
      bucket: parseInt(bucket),
      confidence_range: (parseInt(bucket) * 0.1).toFixed(1),
      brand_count: count
    })).sort((a, b) => a.bucket - b.bucket);

    // 3. Low-confidence high-score anomalies
    const { data: anomalies, error: anomError } = await supabase
      .from('brand_score_effective_named')
      .select('brand_name, baseline_score, confidence, events_365d')
      .gte('baseline_score', 70)
      .lt('confidence', 0.2)
      .order('baseline_score', { ascending: false })
      .limit(10);

    if (anomError) throw anomError;

    // 4. Coverage refresh status
    const { data: refreshStatus, error: refreshError } = await supabase
      .from('brand_score_effective_named')
      .select('last_event_at')
      .not('last_event_at', 'is', null)
      .order('last_event_at', { ascending: false })
      .limit(5);

    if (refreshError) throw refreshError;

    // 5. Overall stats - calculate from fetched data
    const stats = {
      total_brands: allScores?.length || 0,
      brands_with_data: allScores?.filter(s => (s.confidence || 0) > 0).length || 0,
      high_confidence_brands: allScores?.filter(s => (s.confidence || 0) >= 0.7).length || 0,
      low_confidence_brands: allScores?.filter(s => (s.confidence || 0) < 0.35 && (s.confidence || 0) > 0).length || 0,
      avg_confidence: allScores?.length ? 
        (allScores.reduce((sum, s) => sum + (s.confidence || 0), 0) / allScores.length).toFixed(3) : '0.000',
      zero_event_brands: majorBrands?.filter(b => b.events_365d === 0).length || 0
    };

    const report = {
      timestamp: new Date().toISOString(),
      major_brands: majorBrands,
      confidence_distribution: distribution,
      anomalies: anomalies,
      recent_events: refreshStatus,
      overall_stats: stats,
      summary: {
        total_checks: 5,
        status: 'healthy',
        warnings: [] as string[]
      }
    };

    // Add warnings
    if (majorBrands) {
      const noCoverage = majorBrands.filter(b => b.events_365d === 0);
      if (noCoverage.length > 0) {
        report.summary.warnings.push(
          `${noCoverage.length} major brands have zero events: ${noCoverage.map(b => b.brand_name).join(', ')}`
        );
      }
    }

    if (anomalies && anomalies.length > 5) {
      report.summary.warnings.push(
        `${anomalies.length} brands have high scores (≥70) but low confidence (<0.2)`
      );
    }

    console.log('[validate-coverage-health] Validation complete:', report.summary);

    return new Response(
      JSON.stringify(report),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error('[validate-coverage-health] error:', e);
    return new Response(
      JSON.stringify({ error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
