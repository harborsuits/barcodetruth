
-- Add brand metadata for relevance filtering
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS aliases text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ticker text,
  ADD COLUMN IF NOT EXISTS newsroom_domains text[] DEFAULT '{}';

COMMENT ON COLUMN brands.aliases IS 'Alternative names and product lines for brand matching (e.g., GMI, Cheerios)';
COMMENT ON COLUMN brands.ticker IS 'Stock ticker symbol (e.g., GIS for General Mills)';
COMMENT ON COLUMN brands.newsroom_domains IS 'Domains owned by the brand for press releases (e.g., generalmills.com)';

-- Add relevance tracking to brand_events
ALTER TABLE brand_events
  ADD COLUMN IF NOT EXISTS relevance_score integer,
  ADD COLUMN IF NOT EXISTS disambiguation_reason text;

COMMENT ON COLUMN brand_events.relevance_score IS 'Computed relevance score (0-20) based on brand name matching, domain, and disambiguation';
COMMENT ON COLUMN brand_events.disambiguation_reason IS 'Reason for low relevance or negative disambiguation matches';

-- Populate some common aliases for major brands
UPDATE brands SET 
  aliases = CASE
    WHEN name = 'General Mills' THEN ARRAY['GMI', 'Gen Mills', 'Cheerios', 'Lucky Charms', 'Pillsbury']
    WHEN name = 'Unilever' THEN ARRAY['Unilever PLC', 'Dove', 'Axe', 'Ben & Jerry''s', 'Hellmann''s']
    WHEN name = 'Nestlé' THEN ARRAY['Nestle', 'Nespresso', 'KitKat', 'Purina', 'Gerber']
    WHEN name = 'Procter & Gamble' THEN ARRAY['P&G', 'Tide', 'Pampers', 'Gillette', 'Oral-B']
    WHEN name = 'Coca-Cola' THEN ARRAY['Coke', 'Coca Cola', 'Sprite', 'Fanta', 'Dasani']
    WHEN name = 'PepsiCo' THEN ARRAY['Pepsi', 'Lays', 'Doritos', 'Gatorade', 'Quaker']
    ELSE aliases
  END,
  ticker = CASE
    WHEN name = 'General Mills' THEN 'GIS'
    WHEN name = 'Unilever' THEN 'UL'
    WHEN name = 'Nestlé' THEN 'NSRGY'
    WHEN name = 'Procter & Gamble' THEN 'PG'
    WHEN name = 'Coca-Cola' THEN 'KO'
    WHEN name = 'PepsiCo' THEN 'PEP'
    WHEN name = 'Johnson & Johnson' THEN 'JNJ'
    WHEN name = 'Mondelez International' THEN 'MDLZ'
    WHEN name = 'Starbucks' THEN 'SBUX'
    WHEN name = 'Nike' THEN 'NKE'
    ELSE ticker
  END
WHERE is_active = true;
