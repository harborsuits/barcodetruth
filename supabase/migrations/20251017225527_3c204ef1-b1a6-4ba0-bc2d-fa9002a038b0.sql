-- Add FK constraint from event_sources to brand_events if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'event_sources_event_id_fkey'
  ) THEN
    ALTER TABLE event_sources
      ADD CONSTRAINT event_sources_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES brand_events(event_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index on event_sources.event_id for faster joins
CREATE INDEX IF NOT EXISTS event_sources_event_id_idx ON event_sources(event_id);

-- Ensure brand_events has unique constraint on event_id (should already exist as PK)
-- Just verify the column is there and indexed
CREATE INDEX IF NOT EXISTS brand_events_event_id_idx ON brand_events(event_id);