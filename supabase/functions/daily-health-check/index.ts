import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = performance.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Health Check] Starting daily health check...');
    
    const metrics: any[] = [];
    let autoFixCount = 0;

    // CHECK 1: Invalid brands (patents/trademarks that snuck through)
    const { data: invalidBrands } = await supabase
      .from('brands')
      .select('id, name')
      .or('name.ilike.%patent%,name.ilike.%trademark%,name.ilike.%article of%')
      .limit(100);

    if (invalidBrands && invalidBrands.length > 0) {
      metrics.push({
        metric_name: 'invalid_brands',
        entity_type: 'brand',
        score: Math.max(0, 100 - (invalidBrands.length * 2)),
        status: invalidBrands.length > 10 ? 'critical' : invalidBrands.length > 5 ? 'poor' : 'fair',
        issues: invalidBrands.slice(0, 10).map(b => b.name),
        recommendations: ['Review and delete invalid brands', 'Check brand-match validation'],
        checked_at: new Date().toISOString()
      });
      
      console.log(`[Health Check] Found ${invalidBrands.length} invalid brands`);
    }

    // CHECK 2: Miscategorized events (politics keywords but not POLICY category)
    const { data: miscategorized } = await supabase
      .from('brand_events')
      .select('id, title, category_code')
      .or('title.ilike.%trump%,title.ilike.%biden%,title.ilike.%president%,title.ilike.%election%')
      .not('category_code', 'like', 'POLICY%')
      .gte('event_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    if (miscategorized && miscategorized.length > 0) {
      metrics.push({
        metric_name: 'miscategorized_political_events',
        entity_type: 'event',
        score: Math.max(0, 100 - (miscategorized.length * 3)),
        status: miscategorized.length > 10 ? 'critical' : miscategorized.length > 5 ? 'poor' : 'fair',
        issues: miscategorized.slice(0, 5).map(e => e.title),
        recommendations: ['Review categorization keywords', 'Check event categorization logic'],
        checked_at: new Date().toISOString()
      });
      
      console.log(`[Health Check] Found ${miscategorized.length} miscategorized events`);
    }

    // CHECK 3: Invalid ownership relationships
    const { data: invalidOwnership } = await supabase
      .from('company_ownership')
      .select('id, parent_name, child_name')
      .or('child_name.ilike.%patent%,child_name.ilike.%trademark%,child_name.ilike.%article of%')
      .limit(100);

    if (invalidOwnership && invalidOwnership.length > 0) {
      metrics.push({
        metric_name: 'invalid_ownership',
        entity_type: 'ownership',
        score: Math.max(0, 100 - (invalidOwnership.length * 2)),
        status: invalidOwnership.length > 10 ? 'critical' : 'poor',
        issues: invalidOwnership.slice(0, 10).map(o => `${o.parent_name} → ${o.child_name}`),
        recommendations: ['Delete invalid ownership records', 'Re-run Wikidata enrichment'],
        checked_at: new Date().toISOString()
      });

      console.log(`[Health Check] Found ${invalidOwnership.length} invalid ownership records, auto-deleting...`);

      // AUTO-FIX: Delete invalid ownership
      const { error: deleteError } = await supabase
        .from('company_ownership')
        .delete()
        .in('id', invalidOwnership.map(o => o.id));

      if (!deleteError) {
        autoFixCount += invalidOwnership.length;
        await supabase.from('data_quality_log').insert({
          action: 'auto_delete_invalid_ownership',
          entity_type: 'ownership',
          count: invalidOwnership.length,
          details: { deleted_ids: invalidOwnership.map(o => o.id) },
          timestamp: new Date().toISOString()
        });
        
        console.log(`[Health Check] Auto-deleted ${invalidOwnership.length} invalid ownership records`);
      } else {
        console.error('[Health Check] Failed to delete invalid ownership:', deleteError);
      }
    }

    // CHECK 4: Missing logos
    const { data: missingLogos } = await supabase
      .from('brands')
      .select('id, name')
      .is('logo_url', null)
      .eq('is_active', true)
      .limit(100);

    if (missingLogos && missingLogos.length > 0) {
      metrics.push({
        metric_name: 'missing_logos',
        entity_type: 'brand',
        score: Math.max(0, 100 - missingLogos.length),
        status: missingLogos.length > 20 ? 'poor' : 'fair',
        issues: [`${missingLogos.length} active brands missing logos`],
        recommendations: ['Run batch logo resolution', 'Check Clearbit API limits'],
        checked_at: new Date().toISOString()
      });
      
      console.log(`[Health Check] Found ${missingLogos.length} brands missing logos`);
    }

    // CHECK 5: Malformed slugs
    const { data: badSlugs } = await supabase
      .from('brands')
      .select('id, name, slug')
      .or('slug.is.null,slug.eq.')
      .limit(100);

    if (badSlugs && badSlugs.length > 0) {
      metrics.push({
        metric_name: 'malformed_slugs',
        entity_type: 'brand',
        score: Math.max(0, 100 - (badSlugs.length * 2)),
        status: badSlugs.length > 10 ? 'critical' : 'poor',
        issues: badSlugs.slice(0, 10).map(b => b.name),
        recommendations: ['Regenerate slugs from brand names', 'Add slug validation'],
        checked_at: new Date().toISOString()
      });

      console.log(`[Health Check] Found ${badSlugs.length} malformed slugs, auto-fixing...`);

      // AUTO-FIX: Generate slugs
      for (const brand of badSlugs) {
        const newSlug = brand.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 63);

        await supabase
          .from('brands')
          .update({ slug: newSlug })
          .eq('id', brand.id);
        
        autoFixCount++;
      }

      if (badSlugs.length > 0) {
        await supabase.from('data_quality_log').insert({
          action: 'auto_fix_slugs',
          entity_type: 'brand',
          count: badSlugs.length,
          timestamp: new Date().toISOString()
        });
        
        console.log(`[Health Check] Auto-fixed ${badSlugs.length} malformed slugs`);
      }
    }

    // Insert all metrics
    if (metrics.length > 0) {
      const { error: metricsError } = await supabase
        .from('data_quality_metrics')
        .insert(metrics);
      
      if (metricsError) {
        console.error('[Health Check] Failed to insert metrics:', metricsError);
      }
    }

    // Calculate overall health score
    const overallScore = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length
      : 100;

    const criticalCount = metrics.filter(m => m.status === 'critical').length;
    const poorCount = metrics.filter(m => m.status === 'poor').length;
    const healthyCount = metrics.filter(m => m.status === 'excellent' || m.status === 'good').length;

    // Insert health check result
    const { error: healthError } = await supabase
      .from('health_check_results')
      .insert({
        overall_score: overallScore,
        total_entities: metrics.length,
        healthy_entities: healthyCount,
        warning_entities: poorCount,
        critical_entities: criticalCount,
        trending: overallScore > 80 ? 'stable' : overallScore > 60 ? 'degrading' : 'critical',
        priority_fixes: metrics
          .filter(m => m.status === 'critical' || m.status === 'poor')
          .map(m => ({
            metric: m.metric_name,
            status: m.status,
            count: Array.isArray(m.issues) ? m.issues.length : 1
          })),
        checked_at: new Date().toISOString()
      });

    if (healthError) {
      console.error('[Health Check] Failed to insert health result:', healthError);
    }

    const duration = Math.round(performance.now() - t0);
    
    console.log(JSON.stringify({
      level: 'info',
      fn: 'daily-health-check',
      status: 'success',
      overall_score: overallScore.toFixed(1),
      metrics_checked: metrics.length,
      critical_issues: criticalCount,
      auto_fixes: autoFixCount,
      duration_ms: duration
    }));

    return new Response(
      JSON.stringify({
        success: true,
        overall_score: parseFloat(overallScore.toFixed(1)),
        metrics_checked: metrics.length,
        critical_issues: criticalCount,
        warning_issues: poorCount,
        auto_fixes_applied: autoFixCount,
        message: 'Health check complete',
        metrics: metrics.map(m => ({
          name: m.metric_name,
          score: m.score,
          status: m.status
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const duration = Math.round(performance.now() - t0);
    console.error(JSON.stringify({
      level: 'error',
      fn: 'daily-health-check',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: duration
    }));
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
