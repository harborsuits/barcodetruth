-- Fix brand_trending to include events_365d in output
DROP VIEW IF EXISTS brand_trending CASCADE;

CREATE VIEW brand_trending AS
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
  s.events_365d,  -- Include this column in output
  ( 1.5*COALESCE(s.events_7d,0)
  + 1.0*COALESCE(s.events_30d,0)
  + 3.0*COALESCE(s.verified_rate,0)
  + 0.5*LEAST(COALESCE(s.independent_sources,0), 5)
  + 0.1*COALESCE(s.events_365d,0)
  )::numeric(10,4) AS trend_score
FROM brand_standings s
WHERE s.score IS NOT NULL
  AND (s.events_30d > 0 OR s.events_365d > 0)
ORDER BY trend_score DESC, last_event_at DESC;