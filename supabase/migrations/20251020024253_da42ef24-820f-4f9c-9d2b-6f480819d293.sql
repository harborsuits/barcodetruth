-- Create ops_health_24h view for real-time operational monitoring
-- Shows all critical health metrics in one view

CREATE OR REPLACE VIEW ops_health_24h AS
WITH base AS (
  SELECT *
  FROM brand_events
  WHERE event_date >= NOW() - INTERVAL '24 hours'
),
kpis AS (
  SELECT
    COUNT(*)::integer                                                    AS total_24h,
    COUNT(*) FILTER (WHERE relevance_score_raw < 11)::integer           AS below_gate,
    COUNT(*) FILTER (WHERE category_code IS NULL)::integer              AS null_category,
    COUNT(*) FILTER (
      WHERE verification NOT IN ('official','corroborated','unverified') 
         OR verification IS NULL
    )::integer                                                           AS bad_verification
  FROM base
),
cats AS (
  SELECT 
    category_code, 
    COUNT(*)::integer AS n
  FROM base
  WHERE is_irrelevant = false OR is_irrelevant IS NULL
  GROUP BY 1
  ORDER BY n DESC
),
verif AS (
  SELECT 
    verification::text AS verification, 
    COUNT(*)::integer AS n
  FROM base
  GROUP BY 1
  ORDER BY n DESC
)
SELECT
  k.total_24h,
  k.below_gate,
  k.null_category,
  k.bad_verification,
  (SELECT json_agg(cats ORDER BY cats.n DESC) FROM cats)   AS category_breakdown,
  (SELECT json_agg(verif ORDER BY verif.n DESC) FROM verif) AS verification_breakdown
FROM kpis k;

-- Grant read access to authenticated users
GRANT SELECT ON ops_health_24h TO authenticated;
GRANT SELECT ON ops_health_24h TO anon;