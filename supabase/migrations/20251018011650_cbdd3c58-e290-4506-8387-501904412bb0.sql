-- Recreate brand_standings without score_confidence from coverage
DROP VIEW IF EXISTS brand_standings CASCADE;
CREATE VIEW brand_standings AS
SELECT
  b.id AS brand_id,
  b.name,
  b.parent_company,
  bs.score_labor AS score,
  CASE 
    WHEN c.events_365d >= 10 THEN 0.90
    WHEN c.events_365d >= 5 THEN 0.75
    WHEN c.events_365d >= 1 THEN 0.60
    ELSE 0.30
  END::numeric(5,4) AS score_confidence,
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

-- Recreate brand_trending view
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
  + 0.01*COALESCE(s.score,50)
  )::numeric(10,4) AS trend_score
FROM brand_standings s
WHERE s.score IS NOT NULL
ORDER BY trend_score DESC, s.score DESC, last_event_at DESC;