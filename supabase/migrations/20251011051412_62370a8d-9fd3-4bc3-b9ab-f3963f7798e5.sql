-- Fix brand_data_coverage to prevent inflated counts from join duplication
DROP MATERIALIZED VIEW IF EXISTS brand_data_coverage CASCADE;

CREATE MATERIALIZED VIEW brand_data_coverage AS
SELECT
  b.id AS brand_id,
  COUNT(DISTINCT be.event_id) FILTER (
    WHERE be.event_date >= NOW() - INTERVAL '90 days'
  ) AS events_90d,
  COUNT(DISTINCT be.event_id) FILTER (
    WHERE be.event_date >= NOW() - INTERVAL '365 days'
  ) AS events_365d,
  COALESCE(
    AVG((be.verification = 'official')::int) FILTER (
      WHERE be.event_date >= NOW() - INTERVAL '365 days'
    ),
    0
  ) AS verified_rate,
  COUNT(DISTINCT es.domain_owner) FILTER (
    WHERE be.event_date >= NOW() - INTERVAL '365 days'
  ) AS independent_sources,
  MAX(be.event_date) AS last_event_at
FROM brands b
LEFT JOIN brand_events be ON be.brand_id = b.id
LEFT JOIN event_sources es ON es.event_id = be.event_id
GROUP BY b.id;

-- Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS brand_data_coverage_brand_idx ON brand_data_coverage(brand_id);
CREATE INDEX IF NOT EXISTS brand_events_brand_date_idx ON brand_events(brand_id, event_date);
CREATE INDEX IF NOT EXISTS brand_events_brand_verif_idx ON brand_events(brand_id, verification);
CREATE INDEX IF NOT EXISTS event_sources_event_owner_idx ON event_sources(event_id, domain_owner);

-- Recreate brand_score_effective view (dependencies were dropped with CASCADE)
CREATE OR REPLACE VIEW brand_score_effective 
WITH (security_invoker = true) AS
SELECT
  bs.brand_id,
  bs.score_labor + bs.score_environment + bs.score_politics + bs.score_social AS baseline_score,
  COALESCE(c.events_90d, 0) AS events_90d,
  COALESCE(c.events_365d, 0) AS events_365d,
  COALESCE(c.verified_rate, 0) AS verified_rate,
  COALESCE(c.independent_sources, 0) AS independent_sources,
  LEAST(
    1.0,
    0.60 * LN(1 + COALESCE(c.events_365d, 0)) / LN(21) +
    0.25 * COALESCE(c.verified_rate, 0) +
    0.15 * LEAST(COALESCE(c.independent_sources, 0) / 3.0, 1.0)
  ) AS confidence,
  bs.score_labor + bs.score_environment + bs.score_politics + bs.score_social AS evidence_score,
  ROUND(
    (1 - LEAST(
      1.0,
      0.60 * LN(1 + COALESCE(c.events_365d, 0)) / LN(21) +
      0.25 * COALESCE(c.verified_rate, 0) +
      0.15 * LEAST(COALESCE(c.independent_sources, 0) / 3.0, 1.0)
    )) * (bs.score_labor + bs.score_environment + bs.score_politics + bs.score_social) +
    LEAST(
      1.0,
      0.60 * LN(1 + COALESCE(c.events_365d, 0)) / LN(21) +
      0.25 * COALESCE(c.verified_rate, 0) +
      0.15 * LEAST(COALESCE(c.independent_sources, 0) / 3.0, 1.0)
    ) * (bs.score_labor + bs.score_environment + bs.score_politics + bs.score_social)
  )::int AS overall_effective,
  c.last_event_at
FROM brand_scores bs
LEFT JOIN brand_data_coverage c ON c.brand_id = bs.brand_id;

-- Create named view to eliminate N+1 queries in trending
CREATE OR REPLACE VIEW brand_score_effective_named AS
SELECT
  bse.brand_id,
  b.name AS brand_name,
  bse.baseline_score,
  bse.events_90d,
  bse.events_365d,
  bse.verified_rate,
  bse.independent_sources,
  bse.last_event_at,
  bse.confidence,
  bse.evidence_score,
  bse.overall_effective
FROM brand_score_effective bse
JOIN brands b ON b.id = bse.brand_id;

-- Grant permissions
GRANT SELECT ON brand_data_coverage TO authenticated, anon;
GRANT SELECT ON brand_score_effective TO authenticated, anon;
GRANT SELECT ON brand_score_effective_named TO authenticated, anon;