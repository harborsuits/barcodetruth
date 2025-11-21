-- Fix impact scores: move impact from wrong category to correct category
UPDATE brand_events
SET 
  impact_labor = CASE WHEN category = 'labor' THEN -5 ELSE 0 END,
  impact_environment = CASE WHEN category = 'environment' THEN -5 ELSE 0 END,
  impact_politics = CASE WHEN category = 'politics' THEN -5 ELSE 0 END,
  impact_social = CASE WHEN category = 'social' THEN -5 ELSE 0 END
WHERE is_irrelevant = false
  AND category_code NOT LIKE 'NOISE.%'
  AND (
    (category = 'labor' AND COALESCE(impact_labor, 0) = 0)
    OR (category = 'environment' AND COALESCE(impact_environment, 0) = 0)
    OR (category = 'politics' AND COALESCE(impact_politics, 0) = 0)
    OR (category = 'social' AND (COALESCE(impact_social, 0) != -5 AND COALESCE(impact_social, 0) != 0))
  );