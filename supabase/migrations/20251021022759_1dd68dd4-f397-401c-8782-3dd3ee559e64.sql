-- Step 5: Backfill existing events with proper categories and impact scores
-- This is a one-time migration to fix historical data

-- Update existing events with mapped main categories
UPDATE brand_events
SET category = CASE
  WHEN category_code LIKE 'LABOR.%' OR category_code = 'REGULATORY.OSHA' THEN 'labor'::event_category
  WHEN category_code LIKE 'ESG.%' OR category_code = 'REGULATORY.EPA' THEN 'environment'::event_category
  WHEN category_code LIKE 'POLICY.%' OR category_code IN ('REGULATORY.FTC', 'REGULATORY.SEC') THEN 'politics'::event_category
  WHEN category_code LIKE 'NOISE.%' OR category_code LIKE 'FIN.%' THEN 'social'::event_category -- Map noise to social for now
  ELSE 'social'::event_category
END
WHERE category_code IS NOT NULL 
  AND (category IS NULL OR category = 'general'::event_category);

-- Calculate and set impact scores for existing events based on severity
UPDATE brand_events
SET 
  impact_labor = CASE 
    WHEN category = 'labor' THEN
      CASE severity
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
      CASE severity
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
      CASE severity
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
      CASE severity
        WHEN 'catastrophic' THEN -10
        WHEN 'severe' THEN -7
        WHEN 'moderate' THEN -5
        WHEN 'minor' THEN -3
        ELSE -4
      END
    ELSE NULL
  END
WHERE (impact_labor IS NULL AND impact_environment IS NULL AND impact_politics IS NULL AND impact_social IS NULL)
  AND category IS NOT NULL;