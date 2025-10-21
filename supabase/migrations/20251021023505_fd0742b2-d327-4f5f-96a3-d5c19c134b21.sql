-- Fix: Set proper negative impact scores based on severity
-- CRITICAL: Use NULL for non-matching categories, not 0!
UPDATE brand_events
SET 
  impact_labor = CASE 
    WHEN category = 'labor' THEN
      CASE COALESCE(severity, 'moderate')
        WHEN 'catastrophic' THEN -10
        WHEN 'severe' THEN -7
        WHEN 'moderate' THEN -5
        WHEN 'minor' THEN -3
        ELSE -4
      END
    ELSE NULL
  END,
  impact_environment = CASE 
    WHEN category = 'environment' THEN
      CASE COALESCE(severity, 'moderate')
        WHEN 'catastrophic' THEN -10
        WHEN 'severe' THEN -7
        WHEN 'moderate' THEN -5
        WHEN 'minor' THEN -3
        ELSE -4
      END
    ELSE NULL
  END,
  impact_politics = CASE 
    WHEN category = 'politics' THEN
      CASE COALESCE(severity, 'moderate')
        WHEN 'catastrophic' THEN -10
        WHEN 'severe' THEN -7
        WHEN 'moderate' THEN -5
        WHEN 'minor' THEN -3
        ELSE -4
      END
    ELSE NULL
  END,
  impact_social = CASE 
    WHEN category = 'social' THEN
      CASE COALESCE(severity, 'moderate')
        WHEN 'catastrophic' THEN -10
        WHEN 'severe' THEN -7
        WHEN 'moderate' THEN -5
        WHEN 'minor' THEN -3
        ELSE -4
      END
    ELSE NULL
  END
WHERE category IN ('labor', 'environment', 'politics', 'social');