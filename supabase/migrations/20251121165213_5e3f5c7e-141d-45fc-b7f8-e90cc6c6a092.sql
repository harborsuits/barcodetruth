-- Fix orientation and recalculate impacts based on content (with proper enum casting)
UPDATE brand_events
SET 
  orientation = CASE
    WHEN title ~* '(lawsuit|violation|penalty|fine|recall|scandal|accused|alleged|investigation|charged|contamination|injury|death|fraud)' 
      AND title !~* '(award|certification|honored|recognized|praised|improved|success|breakthrough|innovation|leadership|chooses|selects|partners)' 
      THEN 'negative'::event_orientation
    WHEN title ~* '(award|certification|honored|recognized|praised|improved|success|breakthrough|innovation|leadership|chooses|selects|partners)' 
      AND title !~* '(lawsuit|violation|penalty|fine|recall|scandal|accused|alleged|investigation|charged|contamination|injury|death|fraud)'
      THEN 'positive'::event_orientation
    ELSE 'mixed'::event_orientation
  END,
  impact_labor = CASE 
    WHEN category = 'labor' THEN
      CASE
        WHEN title ~* '(lawsuit|violation|penalty|fine|recall|scandal|accused|alleged|investigation|charged|contamination|injury|death|fraud)' 
          AND title !~* '(award|certification|honored|recognized|praised|improved|success|breakthrough|innovation|leadership)'
          THEN -5
        WHEN title ~* '(award|certification|honored|recognized|praised|improved|success|breakthrough|innovation|leadership)'
          AND title !~* '(lawsuit|violation|penalty|fine|recall|scandal|accused|alleged|investigation|charged)'
          THEN 3
        ELSE -3
      END
    ELSE 0
  END,
  impact_environment = CASE 
    WHEN category = 'environment' THEN
      CASE
        WHEN title ~* '(lawsuit|violation|penalty|fine|recall|scandal|accused|alleged|investigation|charged|contamination|injury|death|fraud)'
          AND title !~* '(award|certification|honored|recognized|praised|improved|success|breakthrough|innovation|leadership)'
          THEN -5
        WHEN title ~* '(award|certification|honored|recognized|praised|improved|success|breakthrough|innovation|leadership)'
          AND title !~* '(lawsuit|violation|penalty|fine|recall|scandal|accused|alleged|investigation|charged)'
          THEN 3
        ELSE -3
      END
    ELSE 0
  END,
  impact_politics = CASE 
    WHEN category = 'politics' THEN
      CASE
        WHEN title ~* '(lawsuit|violation|penalty|fine|recall|scandal|accused|alleged|investigation|charged|contamination|injury|death|fraud)'
          AND title !~* '(award|certification|honored|recognized|praised|improved|success|breakthrough|innovation|leadership)'
          THEN -5
        WHEN title ~* '(award|certification|honored|recognized|praised|improved|success|breakthrough|innovation|leadership)'
          AND title !~* '(lawsuit|violation|penalty|fine|recall|scandal|accused|alleged|investigation|charged)'
          THEN 3
        ELSE -3
      END
    ELSE 0
  END,
  impact_social = CASE 
    WHEN category = 'social' THEN
      CASE
        WHEN title ~* '(lawsuit|violation|penalty|fine|recall|scandal|accused|alleged|investigation|charged|contamination|injury|death|fraud)'
          AND title !~* '(award|certification|honored|recognized|praised|improved|success|breakthrough|innovation|leadership)'
          THEN -5
        WHEN title ~* '(award|certification|honored|recognized|praised|improved|success|breakthrough|innovation|leadership)'
          AND title !~* '(lawsuit|violation|penalty|fine|recall|scandal|accused|alleged|investigation|charged)'
          THEN 3
        ELSE -3
      END
    ELSE 0
  END
WHERE is_irrelevant = false
  AND category_code NOT LIKE 'NOISE.%';