
-- Improve event orientation classification with better keywords
UPDATE brand_events 
SET orientation = CASE
  -- Strong negative indicators
  WHEN title ILIKE ANY(ARRAY[
    '%lawsuit%','%sued%','%violation%','%scandal%','%accused%','%investigation%',
    '%fine%','%penalty%','%strike%','%protest%','%boycott%',
    '%recall%','%contamination%','%injury%','%death%','%hazard%','%unsafe%',
    '%toxic%','%pollution%','%spill%','%leak%',
    '%discrimination%','%harassment%','%abuse%','%exploit%',
    '%fraud%','%deception%','%misleading%',
    '%fired%','%layoff%','%union bust%','%wage theft%',
    '%child labor%','%forced labor%','%sweatshop%'
  ])
    THEN 'negative'::event_orientation
    
  -- Strong positive indicators  
  WHEN title ILIKE ANY(ARRAY[
    '%award%','%innovation%','%partnership%','%sustainable%',
    '%donation%','%charity%','%volunteer%','%milestone%','%achievement%',
    '%certification%','%certified%','%green%','%clean energy%','%renewable%',
    '%ethical%','%fair trade%','%organic%','%carbon neutral%',
    '%diversity%','%inclusion%','%equality%',
    '%transparency%','%accountability%',
    '%safety improvement%','%upgraded%','%enhanced%'
  ])
    THEN 'positive'::event_orientation
    
  -- Everything else stays mixed (news, announcements, neutral business activities)
  ELSE 'mixed'::event_orientation
END
WHERE orientation = 'mixed';
