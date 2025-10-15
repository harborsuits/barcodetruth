-- Add is_test column to brand_events
ALTER TABLE brand_events
ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Quarantine Unilever seed events lacking proof
UPDATE brand_events
SET is_test = TRUE
WHERE brand_id = '4965edf9-68f3-4465-88d1-168bc6cc189a'
  AND COALESCE(source_url, '') = ''
  AND (raw_data IS NULL OR jsonb_typeof(raw_data) = 'null');

-- Quarantine Nestlé seed events lacking proof
UPDATE brand_events
SET is_test = TRUE
WHERE brand_id = 'ced5176a-2adf-4a89-8070-33acd1f4188c'
  AND COALESCE(source_url, '') = ''
  AND (raw_data IS NULL OR jsonb_typeof(raw_data) = 'null');

-- Drop and recreate views to exclude test events
DROP VIEW IF EXISTS brand_score_effective_named CASCADE;
DROP VIEW IF EXISTS brand_score_effective CASCADE;
DROP VIEW IF EXISTS brand_evidence_view CASCADE;
DROP VIEW IF EXISTS brand_evidence_view_base CASCADE;

-- Recreate brand_score_effective view to exclude test events
CREATE VIEW brand_score_effective AS
SELECT
  be.brand_id,
  bs.score_labor AS baseline_score,
  COALESCE(
    bs.score_labor + LEAST(
      GREATEST(
        (COUNT(*) FILTER (WHERE be.verification = 'official') * 2 +
         COUNT(*) FILTER (WHERE be.verification = 'corroborated') -
         COUNT(*) * 0.5)::integer,
        -15
      ),
      15
    ),
    bs.score_labor
  ) AS overall_effective,
  LEAST(
    GREATEST(
      (COUNT(*) FILTER (WHERE be.verification = 'official') * 2 +
       COUNT(*) FILTER (WHERE be.verification = 'corroborated') -
       COUNT(*) * 0.5)::integer,
      -15
    ),
    15
  ) AS evidence_score,
  bdc.events_90d,
  bdc.events_365d,
  bdc.verified_rate,
  bdc.independent_sources,
  GREATEST(
    LEAST(
      (bdc.verified_rate * 50 + 
       LEAST(bdc.independent_sources::float / 3.0, 1.0) * 30 +
       CASE WHEN bdc.events_90d >= 3 THEN 20 ELSE bdc.events_90d::float / 3.0 * 20 END
      ) / 100.0,
      1.0
    ),
    0.0
  ) AS confidence,
  bdc.last_event_at
FROM brand_events be
JOIN brand_scores bs ON bs.brand_id = be.brand_id
LEFT JOIN brand_data_coverage bdc ON bdc.brand_id = be.brand_id
WHERE be.event_date >= NOW() - INTERVAL '90 days'
  AND be.is_test = FALSE
GROUP BY be.brand_id, bs.score_labor, bdc.events_90d, bdc.events_365d, 
         bdc.verified_rate, bdc.independent_sources, bdc.last_event_at;

-- Recreate brand_score_effective_named view
CREATE VIEW brand_score_effective_named AS
SELECT
  bse.*,
  b.name AS brand_name
FROM brand_score_effective bse
JOIN brands b ON b.id = bse.brand_id
WHERE b.is_test = FALSE;

-- Recreate brand_evidence_view_base
CREATE VIEW brand_evidence_view_base AS
SELECT
  be.brand_id,
  be.event_id,
  es.id AS evidence_id,
  be.category,
  es.source_name,
  es.source_url,
  es.archive_url,
  es.source_date,
  es.article_snippet AS snippet,
  be.verification::text AS verification
FROM brand_events be
LEFT JOIN event_sources es ON es.event_id = be.event_id
WHERE be.is_test = FALSE;