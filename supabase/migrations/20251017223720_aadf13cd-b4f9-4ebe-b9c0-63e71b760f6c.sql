-- Schema hardening for URL deduplication
ALTER TABLE event_sources
  ADD COLUMN IF NOT EXISTS canonical_url_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS event_sources_urlhash_uniq
  ON event_sources(canonical_url_hash);

-- Index for brand event recency queries
CREATE INDEX IF NOT EXISTS brand_events_brand_date_idx
  ON brand_events(brand_id, event_date DESC);

-- Safety: Add the GDELT backfill cron
SELECT cron.schedule(
  'gdelt-backfill',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/unified-news-orchestrator?max=20',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI0ODI0MCwiZXhwIjoyMDc0ODI0MjQwfQ.RUZgE9iCxSMTTHOFvXQb_7YCQIhCQD_0_7Oav7DZGjs',
      'Content-Type', 'application/json'
    )
  );
  $$
);