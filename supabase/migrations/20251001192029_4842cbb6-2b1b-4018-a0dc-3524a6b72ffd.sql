-- Add helpful index for brand events queries
CREATE INDEX IF NOT EXISTS idx_brand_events_brand_date 
ON brand_events(brand_id, event_date DESC);

-- Confirm source_url unique constraint exists (already added for EPA)
-- This is idempotent and safe to run multiple times
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'brand_events_source_url_key'
  ) THEN
    ALTER TABLE brand_events 
    ADD CONSTRAINT brand_events_source_url_key UNIQUE (source_url);
  END IF;
END $$;