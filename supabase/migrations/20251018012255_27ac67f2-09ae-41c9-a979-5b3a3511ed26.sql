-- Recategorize Unilever's general events based on content
UPDATE brand_events
SET category = CASE
  -- Labor keywords
  WHEN (title ILIKE ANY(ARRAY['%worker%', '%union%', '%wage%', '%labor%', '%employee%', '%strike%', '%OSHA%', '%workplace%', '%injury%', '%layoff%', '%hiring%', '%job%'])
    OR description ILIKE ANY(ARRAY['%worker%', '%union%', '%wage%', '%labor%', '%employee%', '%strike%', '%OSHA%', '%workplace%', '%injury%', '%layoff%', '%hiring%', '%job%']))
    THEN 'labor'::event_category
  
  -- Environment keywords
  WHEN (title ILIKE ANY(ARRAY['%pollution%', '%EPA%', '%emission%', '%climate%', '%waste%', '%toxic%', '%spill%', '%environmental%', '%carbon%', '%sustainability%', '%green%', '%recycl%'])
    OR description ILIKE ANY(ARRAY['%pollution%', '%EPA%', '%emission%', '%climate%', '%waste%', '%toxic%', '%spill%', '%environmental%', '%carbon%', '%sustainability%', '%green%', '%recycl%']))
    THEN 'environment'::event_category
  
  -- Politics keywords
  WHEN (title ILIKE ANY(ARRAY['%donation%', '%lobby%', '%PAC%', '%campaign%', '%political%', '%election%', '%congress%', '%FEC%', '%legislat%', '%regulat%'])
    OR description ILIKE ANY(ARRAY['%donation%', '%lobby%', '%PAC%', '%campaign%', '%political%', '%election%', '%congress%', '%FEC%', '%legislat%', '%regulat%']))
    THEN 'politics'::event_category
  
  -- Default to social for everything else
  ELSE 'social'::event_category
END
WHERE category = 'general'::event_category
  AND brand_id = (SELECT id FROM brands WHERE name = 'Unilever');