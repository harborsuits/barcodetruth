-- Add unique constraint to prevent duplicate events from same source
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_events_source_url 
ON event_sources(event_id, source_url);

-- Add index for efficient brand_events queries by category and date
CREATE INDEX IF NOT EXISTS idx_brand_events_brand_category_date 
ON brand_events(brand_id, category, event_date DESC);

-- Add index for recent events queries
CREATE INDEX IF NOT EXISTS idx_brand_events_brand_date 
ON brand_events(brand_id, event_date DESC);