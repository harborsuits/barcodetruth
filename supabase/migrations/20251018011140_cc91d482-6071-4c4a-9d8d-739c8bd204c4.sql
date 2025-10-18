-- Recategorize existing general events based on keywords in title and description
UPDATE brand_events
SET category = CASE
  WHEN (title || ' ' || description) ILIKE ANY(ARRAY['%worker%', '%union%', '%wage%', '%labor%', '%employee%', '%strike%', '%OSHA%', '%workplace%', '%injury%', '%fatality%']) THEN 'labor'::event_category
  WHEN (title || ' ' || description) ILIKE ANY(ARRAY['%pollution%', '%EPA%', '%emission%', '%climate%', '%waste%', '%toxic%', '%spill%', '%environmental%', '%carbon%', '%green%']) THEN 'environment'::event_category
  WHEN (title || ' ' || description) ILIKE ANY(ARRAY['%donation%', '%lobby%', '%PAC%', '%campaign%', '%political%', '%election%', '%congress%', '%senate%', '%FEC%']) THEN 'politics'::event_category
  ELSE 'social'::event_category
END
WHERE category = 'general'::event_category;