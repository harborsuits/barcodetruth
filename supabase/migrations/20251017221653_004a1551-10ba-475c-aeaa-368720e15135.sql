-- Relax brand_trending to show top 5 brands with scores
-- even if they don't have events in last 30d
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
  + 0.1*COALESCE(s.events_365d,0)  -- Add yearly activity factor
  )::numeric(10,4) AS trend_score
FROM brand_standings s
WHERE s.score IS NOT NULL  -- Only require a score exists
  AND (s.events_30d > 0 OR s.events_365d > 0)  -- Events in last year OR last 30d
ORDER BY trend_score DESC, last_event_at DESC;