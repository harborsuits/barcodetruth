-- Fix SECURITY DEFINER views by removing the property
-- Public data views don't need elevated permissions

-- Drop and recreate brand_standings without SECURITY DEFINER
DROP VIEW IF EXISTS brand_standings CASCADE;
CREATE VIEW brand_standings AS
  SELECT 
    b.id,
    b.name,
    b.logo_url,
    b.parent_company,
    COALESCE(bs.score, 50) as score,
    COALESCE(bs.score_labor, 50) as score_labor,
    COALESCE(bs.score_environment, 50) as score_environment,
    COALESCE(bs.score_politics, 50) as score_politics,
    COALESCE(bs.score_social, 50) as score_social,
    bs.last_updated,
    COALESCE(bdc.events_30d, 0) as events_30d
  FROM brands b
  LEFT JOIN brand_scores bs ON bs.brand_id = b.id
  LEFT JOIN brand_data_coverage bdc ON bdc.brand_id = b.id
  WHERE b.is_active = true;

-- Drop and recreate brand_trending without SECURITY DEFINER
DROP VIEW IF EXISTS brand_trending CASCADE;
CREATE VIEW brand_trending AS
  SELECT 
    b.id,
    b.name,
    b.logo_url,
    COUNT(be.event_id) as event_count_24h,
    AVG(COALESCE(bs.score, 50)) as avg_score
  FROM brands b
  LEFT JOIN brand_events be ON be.brand_id = b.id 
    AND be.event_date >= now() - interval '24 hours'
  LEFT JOIN brand_scores bs ON bs.brand_id = b.id
  WHERE b.is_active = true
  GROUP BY b.id, b.name, b.logo_url
  HAVING COUNT(be.event_id) >= 2;

-- Drop and recreate brand_score_effective without SECURITY DEFINER
DROP VIEW IF EXISTS brand_score_effective CASCADE;
CREATE VIEW brand_score_effective AS
  SELECT 
    bs.brand_id,
    bs.score,
    bs.score_labor,
    bs.score_environment, 
    bs.score_politics,
    bs.score_social,
    COALESCE(bdc.events_30d, 0) as events_90d,
    COALESCE(bdc.verified_rate, 0) as verified_rate,
    COALESCE(bdc.independent_sources, 0) as independent_sources,
    bs.last_updated
  FROM brand_scores bs
  LEFT JOIN brand_data_coverage bdc ON bdc.brand_id = bs.brand_id;

-- Recreate admin views with simplified queries
DROP VIEW IF EXISTS ops_health_24h CASCADE;
CREATE VIEW ops_health_24h AS
  SELECT 
    'fn_call_log' as component,
    COUNT(*) as total_calls
  FROM fn_call_log
  WHERE created_at >= now() - interval '24 hours'
  UNION ALL
  SELECT 
    'api_errors' as component,
    COUNT(*) as total_calls
  FROM api_error_log
  WHERE occurred_at >= now() - interval '24 hours';

DROP VIEW IF EXISTS v_rate_limit_pressure CASCADE;
CREATE VIEW v_rate_limit_pressure AS
  SELECT 
    rl.source,
    rc.limit_per_window,
    rl.call_count,
    ROUND(100.0 * rl.call_count / NULLIF(rc.limit_per_window, 0), 1) as usage_percent,
    rc.window_kind
  FROM api_rate_limits rl
  JOIN api_rate_config rc ON rc.source = rl.source
  WHERE rl.window_start >= current_window_start(rc.window_kind);