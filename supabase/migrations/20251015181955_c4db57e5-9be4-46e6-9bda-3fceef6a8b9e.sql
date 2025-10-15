-- Fix views with correct link_kind enum values
DROP MATERIALIZED VIEW IF EXISTS brand_data_coverage CASCADE;
CREATE MATERIALIZED VIEW brand_data_coverage AS
SELECT
  b.id AS brand_id,
  b.name,
  b.parent_company,
  COUNT(*) FILTER (
    WHERE be.event_date >= NOW() - INTERVAL '7 days'
      AND be.verification = 'official'
      AND be.is_test = false
  ) AS events_7d,
  COUNT(*) FILTER (
    WHERE be.event_date >= NOW() - INTERVAL '30 days'
      AND be.verification = 'official'
      AND be.is_test = false
  ) AS events_30d,
  COUNT(*) FILTER (
    WHERE be.event_date >= NOW() - INTERVAL '365 days'
      AND be.verification = 'official'
      AND be.is_test = false
  ) AS events_365d,
  COALESCE(
    AVG((be.verification = 'official')::int)
      FILTER (WHERE be.event_date >= NOW() - INTERVAL '365 days' AND be.is_test = false),
    0
  )::numeric(5,4) AS verified_rate,
  COUNT(DISTINCT es.domain_owner) FILTER (
    WHERE be.verification = 'official' AND be.is_test = false
  ) AS independent_sources,
  MAX(be.event_date) FILTER (
    WHERE be.verification = 'official' AND be.is_test = false
  ) AS last_event_at
FROM brands b
LEFT JOIN brand_events be ON be.brand_id = b.id
LEFT JOIN event_sources es ON es.event_id = be.event_id
GROUP BY b.id;

CREATE UNIQUE INDEX IF NOT EXISTS brand_data_coverage_brand_id_idx ON brand_data_coverage(brand_id);

DROP VIEW IF EXISTS brand_latest_verified_event CASCADE;
CREATE OR REPLACE VIEW brand_latest_verified_event AS
SELECT DISTINCT ON (be.brand_id)
  be.brand_id,
  be.event_id,
  be.event_date,
  be.verification,
  be.description AS ai_summary_md
FROM brand_events be
WHERE be.verification = 'official'
  AND be.is_test = false
ORDER BY be.brand_id, be.event_date DESC;

CREATE OR REPLACE VIEW brand_latest_evidence AS
SELECT
  lve.brand_id,
  es.event_id,
  es.title,
  COALESCE(es.canonical_url, es.source_url) AS url,
  es.source_name
FROM brand_latest_verified_event lve
JOIN event_sources es ON es.event_id = lve.event_id
WHERE es.source_url IS NOT NULL
  AND es.source_url ~* '^https?://'
  AND es.link_kind IN ('article','database');

CREATE OR REPLACE VIEW brand_standings AS
SELECT
  b.id AS brand_id,
  b.name,
  b.parent_company,
  bs.score_labor AS score,
  0.8::numeric AS score_confidence,
  c.last_event_at,
  c.verified_rate,
  c.independent_sources,
  c.events_7d,
  c.events_30d,
  c.events_365d,
  lve.ai_summary_md
FROM brands b
LEFT JOIN brand_latest_verified_event lve ON lve.brand_id = b.id
LEFT JOIN brand_data_coverage c ON c.brand_id = b.id
LEFT JOIN brand_scores bs ON bs.brand_id = b.id;

CREATE OR REPLACE VIEW brand_trending AS
SELECT
  s.brand_id,
  s.name,
  s.parent_company,
  s.score,
  s.score_confidence,
  s.last_event_at,
  s.verified_rate,
  s.independent_sources,
  s.events_7d,
  s.events_30d,
  ( 1.5*COALESCE(s.events_7d,0)
  + 1.0*COALESCE(s.events_30d,0)
  + 3.0*COALESCE(s.verified_rate,0)
  + 0.5*LEAST(COALESCE(s.independent_sources,0), 5)
  )::numeric(10,4) AS trend_score
FROM brand_standings s
WHERE s.last_event_at IS NOT NULL
  AND s.events_30d > 0
ORDER BY trend_score DESC, last_event_at DESC;

CREATE INDEX IF NOT EXISTS idx_event_sources_event_id ON event_sources(event_id);

ALTER VIEW brand_standings OWNER TO postgres;
ALTER VIEW brand_trending OWNER TO postgres;
ALTER VIEW brand_latest_evidence OWNER TO postgres;
ALTER VIEW brand_latest_verified_event OWNER TO postgres;
ALTER MATERIALIZED VIEW brand_data_coverage OWNER TO postgres;