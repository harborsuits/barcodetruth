-- Show top 5 brands with scores, even without recent events
-- The trend_score naturally prioritizes brands with more activity
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
  s.events_365d,
  ( 1.5*COALESCE(s.events_7d,0)
  + 1.0*COALESCE(s.events_30d,0)
  + 3.0*COALESCE(s.verified_rate,0)
  + 0.5*LEAST(COALESCE(s.independent_sources,0), 5)
  + 0.1*COALESCE(s.events_365d,0)
  + 0.01*COALESCE(s.score,50)  -- Small score factor to rank brands without events
  )::numeric(10,4) AS trend_score
FROM brand_standings s
WHERE s.score IS NOT NULL  -- Only require score exists
ORDER BY trend_score DESC, s.score DESC, last_event_at DESC;