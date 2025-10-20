
-- Fix RLS permissions for materialized view refresh
-- Grant SELECT permissions to postgres role for view refresh
GRANT SELECT ON brand_events TO postgres;
GRANT SELECT ON event_sources TO postgres;
GRANT SELECT ON brand_scores TO postgres;
GRANT SELECT ON brands TO postgres;
