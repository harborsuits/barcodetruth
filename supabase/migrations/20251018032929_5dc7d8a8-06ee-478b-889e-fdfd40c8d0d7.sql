
-- Add helper function to find brands needing scores
CREATE OR REPLACE FUNCTION get_brands_needing_scores()
RETURNS TABLE (id uuid, name text, event_count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT b.id, b.name, COUNT(be.event_id) as event_count
  FROM brands b
  LEFT JOIN brand_events be ON be.brand_id = b.id
  LEFT JOIN brand_scores bs ON bs.brand_id = b.id
  WHERE b.is_active = true
    AND (bs.brand_id IS NULL OR bs.updated_at < NOW() - INTERVAL '24 hours')
  GROUP BY b.id, b.name
  HAVING COUNT(be.event_id) > 0
  ORDER BY COUNT(be.event_id) DESC
  LIMIT 20;
$$;

-- Fix orientation data for all events based on title keywords
UPDATE brand_events 
SET orientation = CASE
  WHEN title ILIKE ANY(ARRAY['%lawsuit%','%violation%','%scandal%','%accused%','%investigation%','%fine%','%penalty%','%strike%','%protest%','%recall%','%contamination%','%injury%','%death%','%hazard%','%unsafe%','%toxic%','%pollution%'])
    THEN 'negative'::event_orientation
  WHEN title ILIKE ANY(ARRAY['%award%','%innovation%','%partnership%','%sustainable%','%donation%','%volunteer%','%milestone%','%achievement%','%certification%','%green%','%clean%','%ethical%'])
    THEN 'positive'::event_orientation
  ELSE 'mixed'::event_orientation
END
WHERE orientation IS NULL;

-- Create baseline scores for all active brands that don't have scores
INSERT INTO brand_scores (brand_id, score, score_labor, score_environment, score_politics, score_social, last_updated)
SELECT b.id, 50, 50, 50, 50, 50, NOW()
FROM brands b
WHERE b.is_active = true
  AND NOT EXISTS (SELECT 1 FROM brand_scores WHERE brand_id = b.id)
ON CONFLICT (brand_id) DO NOTHING;
