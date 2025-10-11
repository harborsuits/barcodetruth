-- 1) Materialized view: coverage + verification + recency
CREATE MATERIALIZED VIEW IF NOT EXISTS brand_data_coverage AS
SELECT
  b.id                               AS brand_id,
  COUNT(*) FILTER (
    WHERE be.event_date >= NOW() - INTERVAL '90 days'
  )                                   AS events_90d,
  COUNT(*) FILTER (
    WHERE be.event_date >= NOW() - INTERVAL '365 days'
  )                                   AS events_365d,
  COALESCE(
    AVG((be.verification = 'official')::int)
      FILTER (WHERE be.event_date >= NOW() - INTERVAL '365 days'),
    0
  )                                   AS verified_rate,
  COUNT(DISTINCT es.domain_owner)     AS independent_sources,
  MAX(be.event_date)                  AS last_event_at
FROM brands b
LEFT JOIN brand_events be ON be.brand_id = b.id
LEFT JOIN event_sources es ON es.event_id = be.event_id
GROUP BY b.id;

-- 2) Speed it up
CREATE UNIQUE INDEX IF NOT EXISTS brand_data_coverage_brand_idx ON brand_data_coverage(brand_id);
CREATE INDEX IF NOT EXISTS brand_events_brand_date_idx ON brand_events(brand_id, event_date);
CREATE INDEX IF NOT EXISTS brand_events_brand_verif_idx ON brand_events(brand_id, verification);

-- 3) View: effective score with confidence
CREATE OR REPLACE VIEW brand_score_effective AS
SELECT
  bs.brand_id,
  ROUND((bs.score_labor + bs.score_environment + bs.score_politics + bs.score_social) / 4.0)::int AS baseline_score,
  COALESCE(c.events_90d, 0) AS events_90d,
  COALESCE(c.events_365d, 0) AS events_365d,
  COALESCE(c.verified_rate, 0) AS verified_rate,
  COALESCE(c.independent_sources, 0) AS independent_sources,
  c.last_event_at,

  -- Confidence weight in [0,1]
  LEAST(
    1.0,
      0.60 * LN(1 + COALESCE(c.events_365d, 0)) / LN(21)
    + 0.25 * COALESCE(c.verified_rate, 0)
    + 0.15 * LEAST(COALESCE(c.independent_sources, 0) / 3.0, 1.0)
  ) AS confidence,

  -- Evidence-adjusted score (using baseline for now, can be enhanced with real event-based scoring)
  ROUND((bs.score_labor + bs.score_environment + bs.score_politics + bs.score_social) / 4.0)::int AS evidence_score,

  -- Final effective score: (1-confidence)*baseline + confidence*evidence
  ROUND(
    (1 - LEAST(
      1.0,
        0.60 * LN(1 + COALESCE(c.events_365d, 0)) / LN(21)
      + 0.25 * COALESCE(c.verified_rate, 0)
      + 0.15 * LEAST(COALESCE(c.independent_sources, 0) / 3.0, 1.0)
    )) * ROUND((bs.score_labor + bs.score_environment + bs.score_politics + bs.score_social) / 4.0)
    +
    LEAST(
      1.0,
        0.60 * LN(1 + COALESCE(c.events_365d, 0)) / LN(21)
      + 0.25 * COALESCE(c.verified_rate, 0)
      + 0.15 * LEAST(COALESCE(c.independent_sources, 0) / 3.0, 1.0)
    ) * ROUND((bs.score_labor + bs.score_environment + bs.score_politics + bs.score_social) / 4.0)
  )::int AS overall_effective
FROM brand_scores bs
LEFT JOIN brand_data_coverage c ON c.brand_id = bs.brand_id;