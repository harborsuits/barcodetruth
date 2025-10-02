-- Add unique hash index for fast dedupe and performance
-- This prevents duplicates even with long URLs and speeds up lookups

ALTER TABLE brand_events
ADD COLUMN IF NOT EXISTS source_url_sha256 bytea
  GENERATED ALWAYS AS (digest(source_url, 'sha256')) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_events_brand_url_hash
  ON brand_events (brand_id, source_url_sha256);

COMMENT ON COLUMN brand_events.source_url_sha256 IS 'SHA-256 hash of source_url for fast dedupe lookups';
COMMENT ON INDEX uq_brand_events_brand_url_hash IS 'Prevents duplicate events from same source URL per brand';