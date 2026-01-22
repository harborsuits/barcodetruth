-- Fix remaining 2 mixed-negative events (legacy data)
UPDATE brand_events
SET 
  impact_labor = 0,
  impact_environment = 0,
  impact_politics = 0,
  impact_social = 0,
  category_impacts = jsonb_build_object(
    'labor', 0,
    'environment', 0,
    'politics', 0,
    'social', 0
  )
WHERE orientation = 'mixed'
  AND (impact_labor < 0 OR impact_environment < 0 
       OR impact_politics < 0 OR impact_social < 0);