-- Grant select permissions on views (materialized views can't have RLS, but this is aggregate public data)
GRANT SELECT ON brand_data_coverage TO authenticated, anon;
GRANT SELECT ON brand_score_effective TO authenticated, anon;