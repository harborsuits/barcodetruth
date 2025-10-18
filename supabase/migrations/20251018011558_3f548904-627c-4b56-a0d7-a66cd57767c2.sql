-- Update views to accept both official AND corroborated verification levels
DROP MATERIALIZED VIEW IF EXISTS brand_data_coverage CASCADE;
CREATE MATERIALIZED VIEW brand_data_coverage AS
SELECT
  b.id AS brand_id,
  b.name,
  b.parent_company,
  COUNT(*) FILTER (
    WHERE be.event_date >= NOW() - INTERVAL '7 days'
      AND be.verification IN ('official', 'corroborated')
      AND be.is_test = false
  ) AS events_7d,
  COUNT(*) FILTER (
    WHERE be.event_date >= NOW() - INTERVAL '30 days'
      AND be.verification IN ('official', 'corroborated')
      AND be.is_test = false
  ) AS events_30d,
  COUNT(*) FILTER (
    WHERE be.event_date >= NOW() - INTERVAL '365 days'
      AND be.verification IN ('official', 'corroborated')
      AND be.is_test = false
  ) AS events_365d,
  COALESCE(
    AVG((be.verification IN ('official', 'corroborated'))::int)
      FILTER (WHERE be.event_date >= NOW() - INTERVAL '365 days' AND be.is_test = false),
    0
  )::numeric(5,4) AS verified_rate,
  COUNT(DISTINCT es.domain_owner) FILTER (
    WHERE be.verification IN ('official', 'corroborated') AND be.is_test = false
  ) AS independent_sources,
  MAX(be.event_date) FILTER (
    WHERE be.verification IN ('official', 'corroborated') AND be.is_test = false
  ) AS last_event_at
FROM brands b
LEFT JOIN brand_events be ON be.brand_id = b.id
LEFT JOIN event_sources es ON es.event_id = be.event_id
GROUP BY b.id;

CREATE UNIQUE INDEX IF NOT EXISTS brand_data_coverage_brand_id_idx ON brand_data_coverage(brand_id);

-- Update brand_latest_verified_event to accept corroborated
DROP VIEW IF EXISTS brand_latest_verified_event CASCADE;
CREATE OR REPLACE VIEW brand_latest_verified_event AS
SELECT DISTINCT ON (be.brand_id)
  be.brand_id,
  be.event_id,
  be.event_date,
  be.verification,
  be.description AS ai_summary_md
FROM brand_events be
WHERE be.verification IN ('official', 'corroborated')
  AND be.is_test = false
ORDER BY be.brand_id, be.event_date DESC;

-- Recreate brand_latest_evidence view
CREATE OR REPLACE VIEW brand_latest_evidence AS
SELECT
  lve.brand_id,
  es.event_id,
  es.title,
  COALESCE(es.canonical_url, es.source_url) AS url,
  es.source_name
FROM brand_latest_verified_event lve
INNER JOIN event_sources es ON es.event_id = lve.event_id
WHERE es.title IS NOT NULL
  AND es.title <> '';

-- Refresh the materialized view to pick up changes
REFRESH MATERIALIZED VIEW CONCURRENTLY brand_data_coverage;