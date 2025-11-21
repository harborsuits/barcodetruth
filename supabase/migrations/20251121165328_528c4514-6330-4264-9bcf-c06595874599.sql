-- Fix impact scores with COMPLETE positive/negative signal lists
UPDATE brand_events
SET 
  impact_labor = CASE 
    WHEN category = 'labor' AND orientation = 'positive' THEN 3
    WHEN category = 'labor' AND orientation = 'negative' THEN -5
    WHEN category = 'labor' THEN -3
    ELSE 0
  END,
  impact_environment = CASE 
    WHEN category = 'environment' AND orientation = 'positive' THEN 3
    WHEN category = 'environment' AND orientation = 'negative' THEN -5
    WHEN category = 'environment' THEN -3
    ELSE 0
  END,
  impact_politics = CASE 
    WHEN category = 'politics' AND orientation = 'positive' THEN 3
    WHEN category = 'politics' AND orientation = 'negative' THEN -5
    WHEN category = 'politics' THEN -3
    ELSE 0
  END,
  impact_social = CASE 
    WHEN category = 'social' AND orientation = 'positive' THEN 3
    WHEN category = 'social' AND orientation = 'negative' THEN -5
    WHEN category = 'social' THEN -3
    ELSE 0
  END
WHERE is_irrelevant = false;