-- Recreate view with explicit SECURITY INVOKER to fix security definer warning
DROP VIEW IF EXISTS brand_score_effective;

CREATE VIEW brand_score_effective 
WITH (security_invoker = true)
AS
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

  -- Evidence-adjusted score
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

GRANT SELECT ON brand_score_effective TO authenticated, anon;