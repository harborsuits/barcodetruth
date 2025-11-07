
-- Phase 2: Add secondary category support to brand_events
ALTER TABLE brand_events
ADD COLUMN IF NOT EXISTS secondary_category text,
ADD COLUMN IF NOT EXISTS keyword_matches jsonb;

-- Create index for secondary category
CREATE INDEX IF NOT EXISTS idx_events_secondary_category 
ON brand_events(secondary_category) WHERE secondary_category IS NOT NULL;

-- Create index for category_confidence (if not exists)
CREATE INDEX IF NOT EXISTS idx_events_category_confidence
ON brand_events(category_confidence) WHERE category_confidence IS NOT NULL;

COMMENT ON COLUMN brand_events.secondary_category IS 'Secondary category when event spans multiple categories';
COMMENT ON COLUMN brand_events.keyword_matches IS 'JSON object with keyword match scores for each category';
COMMENT ON COLUMN brand_events.category_confidence IS 'Confidence score (0.0-1.0) for the primary category assignment';
