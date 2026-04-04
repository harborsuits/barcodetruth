
-- Fix Kraft Heinz logo URL (was Wikimedia page, need direct image)
UPDATE brands 
SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/5/5f/KraftHeinz.svg'
WHERE id = 'dca50aec-af0d-4afb-812a-15ef77747b69';

-- Fix Kraft sub-brand logo and parent
UPDATE brands 
SET parent_company = 'Kraft Heinz',
    logo_url = 'https://upload.wikimedia.org/wikipedia/commons/5/5f/KraftHeinz.svg'
WHERE id = '9d35a3cb-7302-4222-9080-840920ba55d1';

-- Fix Kraft Singles parent and logo
UPDATE brands 
SET parent_company = 'Kraft Heinz',
    logo_url = 'https://upload.wikimedia.org/wikipedia/commons/5/5f/KraftHeinz.svg'
WHERE id = '81a106dc-f127-4429-9168-d527db8029b5';

-- Make Kraft Heinz events with real news actually score-eligible
UPDATE brand_events 
SET score_eligible = true,
    impact_labor = CASE 
      WHEN category = 'labor' THEN -2
      ELSE impact_labor 
    END,
    impact_environment = CASE 
      WHEN category = 'environment' THEN -1
      ELSE impact_environment 
    END,
    impact_politics = CASE 
      WHEN category = 'politics' THEN -1
      ELSE impact_politics 
    END,
    impact_social = CASE 
      WHEN category = 'social' AND title ILIKE '%merger%' THEN -1
      WHEN category = 'social' AND title ILIKE '%invest%' THEN 1
      WHEN category = 'social' THEN 0
      ELSE impact_social 
    END
WHERE brand_id = 'dca50aec-af0d-4afb-812a-15ef77747b69'
  AND feed_visible = true
  AND relevance_score_raw >= 13
  AND credibility >= 0.6;
