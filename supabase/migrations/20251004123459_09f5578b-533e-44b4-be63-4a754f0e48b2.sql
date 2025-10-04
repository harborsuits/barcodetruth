-- Add unique constraint on event_id + canonical_url to prevent duplicates
ALTER TABLE event_sources
  ADD CONSTRAINT event_sources_eventid_canonical_uniq
  UNIQUE (event_id, canonical_url);

-- Speed up lookups and grouping by registrable domain
CREATE INDEX IF NOT EXISTS event_sources_regdomain_idx
  ON event_sources(registrable_domain);

-- Optional: index on raw source_url for lookups
CREATE INDEX IF NOT EXISTS event_sources_sourceurl_idx
  ON event_sources(source_url);

-- Set default for source_date so callers don't need to fill it
ALTER TABLE event_sources
  ALTER COLUMN source_date SET DEFAULT now();