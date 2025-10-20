-- Fix views to match expected schema and remove all SECURITY DEFINER

-- Fix brand_trending to include brand_id column (simplified version)
DROP VIEW IF EXISTS brand_trending CASCADE;
CREATE VIEW brand_trending AS
  SELECT 
    b.id AS brand_id,
    b.name,
    b.logo_url,
    COUNT(be.event_id) as event_count_24h,
    AVG(COALESCE(bs.score, 50)) as avg_score,
    COALESCE(bs.score, 50) as score,
    COUNT(DISTINCT CASE WHEN be.event_date >= now() - interval '7 days' THEN be.event_id END) as events_7d,
    COUNT(DISTINCT CASE WHEN be.event_date >= now() - interval '30 days' THEN be.event_id END) as events_30d,
    COALESCE(bdc.verified_rate, 0) as verified_rate,
    COALESCE(bdc.independent_sources, 0) as independent_sources,
    MAX(be.event_date) as last_event_at,
    COUNT(DISTINCT CASE WHEN be.event_date >= now() - interval '24 hours' THEN be.event_id END) as trend_score
  FROM brands b
  LEFT JOIN brand_events be ON be.brand_id = b.id 
  LEFT JOIN brand_scores bs ON bs.brand_id = b.id
  LEFT JOIN brand_data_coverage bdc ON bdc.brand_id = b.id
  WHERE b.is_active = true
  GROUP BY b.id, b.name, b.logo_url, bs.score, bdc.verified_rate, bdc.independent_sources
  HAVING COUNT(DISTINCT CASE WHEN be.event_date >= now() - interval '24 hours' THEN be.event_id END) >= 2;

-- Fix ops_health_24h to return expected structure
DROP VIEW IF EXISTS ops_health_24h CASCADE;
CREATE VIEW ops_health_24h AS
  WITH event_stats AS (
    SELECT 
      COUNT(*)::integer as total_24h,
      COUNT(*) FILTER (WHERE relevance_score_raw < 11)::integer as below_gate,
      COUNT(*) FILTER (WHERE category_code IS NULL)::integer as null_category,
      COUNT(*) FILTER (WHERE verification NOT IN ('official', 'corroborated', 'unverified'))::integer as bad_verification
    FROM brand_events
    WHERE event_date >= now() - interval '24 hours'
  ),
  category_stats AS (
    SELECT 
      COALESCE(category_code, 'NULL') as category_code,
      COUNT(*)::integer as n
    FROM brand_events
    WHERE event_date >= now() - interval '24 hours'
    GROUP BY category_code
    ORDER BY COUNT(*) DESC
    LIMIT 20
  ),
  verification_stats AS (
    SELECT 
      COALESCE(verification::text, 'NULL') as verification,
      COUNT(*)::integer as n
    FROM brand_events
    WHERE event_date >= now() - interval '24 hours'
    GROUP BY verification
    ORDER BY COUNT(*) DESC
  )
  SELECT 
    es.total_24h,
    es.below_gate,
    es.null_category,
    es.bad_verification,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('category_code', category_code, 'n', n) ORDER BY n DESC) FROM category_stats), '[]'::jsonb) as category_breakdown,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('verification', verification, 'n', n) ORDER BY n DESC) FROM verification_stats), '[]'::jsonb) as verification_breakdown
  FROM event_stats es;