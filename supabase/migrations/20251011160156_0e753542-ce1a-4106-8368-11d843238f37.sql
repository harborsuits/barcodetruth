-- Harden brand_score_effective with comprehensive range caps and null-safe averaging

DROP VIEW IF EXISTS brand_score_effective_named;
DROP VIEW IF EXISTS brand_score_effective;

CREATE OR REPLACE VIEW brand_score_effective AS
SELECT
  bs.brand_id,
  -- Average with null-safety, capped 0-100
  LEAST(100, GREATEST(0, ROUND((
    COALESCE(bs.score_labor, 50) + 
    COALESCE(bs.score_environment, 50) + 
    COALESCE(bs.score_politics, 50) + 
    COALESCE(bs.score_social, 50)
  ) / 4.0)::int)) AS baseline_score,
  COALESCE(c.events_90d, 0) AS events_90d,
  COALESCE(c.events_365d, 0) AS events_365d,
  COALESCE(c.verified_rate, 0) AS verified_rate,
  COALESCE(c.independent_sources, 0) AS independent_sources,
  LEAST(1.0,
    0.60 * LN(1 + COALESCE(c.events_365d, 0)) / LN(21)
    + 0.25 * COALESCE(c.verified_rate, 0)
    + 0.15 * LEAST(COALESCE(c.independent_sources, 0) / 3.0, 1.0)
  ) AS confidence,
  -- Evidence score capped 0-100
  LEAST(100, GREATEST(0, ROUND((
    COALESCE(bs.score_labor, 50) + 
    COALESCE(bs.score_environment, 50) + 
    COALESCE(bs.score_politics, 50) + 
    COALESCE(bs.score_social, 50)
  ) / 4.0)::int)) AS evidence_score,
  -- Overall effective score capped 0-100
  LEAST(100, GREATEST(0, ROUND(
    (1 - LEAST(1.0,
      0.60 * LN(1 + COALESCE(c.events_365d, 0)) / LN(21)
      + 0.25 * COALESCE(c.verified_rate, 0)
      + 0.15 * LEAST(COALESCE(c.independent_sources, 0) / 3.0, 1.0)
    )) * (
      COALESCE(bs.score_labor, 50) + 
      COALESCE(bs.score_environment, 50) + 
      COALESCE(bs.score_politics, 50) + 
      COALESCE(bs.score_social, 50)
    ) / 4.0
    +
    LEAST(1.0,
      0.60 * LN(1 + COALESCE(c.events_365d, 0)) / LN(21)
      + 0.25 * COALESCE(c.verified_rate, 0)
      + 0.15 * LEAST(COALESCE(c.independent_sources, 0) / 3.0, 1.0)
    ) * (
      COALESCE(bs.score_labor, 50) + 
      COALESCE(bs.score_environment, 50) + 
      COALESCE(bs.score_politics, 50) + 
      COALESCE(bs.score_social, 50)
    ) / 4.0
  )::int)) AS overall_effective,
  c.last_event_at
FROM brand_scores bs
LEFT JOIN brand_data_coverage c ON c.brand_id = bs.brand_id;

-- Recreate named view
CREATE OR REPLACE VIEW brand_score_effective_named AS
SELECT
  bse.brand_id,
  b.name as brand_name,
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

GRANT SELECT ON brand_score_effective TO authenticated, anon;
GRANT SELECT ON brand_score_effective_named TO authenticated, anon;

COMMENT ON VIEW brand_score_effective IS 
  'Confidence-weighted brand scores. Averages 4 category scores with comprehensive 0-100 range caps on all outputs.';