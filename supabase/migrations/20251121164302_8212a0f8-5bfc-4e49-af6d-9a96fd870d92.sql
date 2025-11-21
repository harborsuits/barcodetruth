-- Fix miscategorized events: align category column with category_code
UPDATE brand_events
SET category = 
  CASE 
    WHEN category_code LIKE 'LABOR.%' THEN 'labor'::event_category
    WHEN category_code LIKE 'ESG.%' THEN 'environment'::event_category
    WHEN category_code LIKE 'POLICY.%' THEN 'politics'::event_category
    WHEN category_code LIKE 'SOCIAL.%' THEN 'social'::event_category
    WHEN category_code LIKE 'PRODUCT.%' THEN 'social'::event_category
    WHEN category_code LIKE 'LEGAL.%' THEN 'social'::event_category
    WHEN category_code LIKE 'FIN.%' THEN 'social'::event_category
    WHEN category_code LIKE 'REGULATORY.%' THEN 'environment'::event_category
    WHEN category_code LIKE 'NOISE.%' THEN 'social'::event_category
    ELSE 'social'::event_category
  END
WHERE category_code IS NOT NULL
  AND category != 
    CASE 
      WHEN category_code LIKE 'LABOR.%' THEN 'labor'::event_category
      WHEN category_code LIKE 'ESG.%' THEN 'environment'::event_category
      WHEN category_code LIKE 'POLICY.%' THEN 'politics'::event_category
      ELSE 'social'::event_category
    END;