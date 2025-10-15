-- 0) Schema guardrails: ensure event_sources has all needed fields
ALTER TABLE event_sources
  ADD COLUMN IF NOT EXISTS title text;

-- source_name, canonical_url already exist, but let's ensure owner_domain
ALTER TABLE event_sources
  ADD COLUMN IF NOT EXISTS owner_domain text;

-- Avoid dupes if a job re-runs
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_sources_event_canonical
  ON event_sources (event_id, canonical_url);

-- Index for efficient primary source lookups
CREATE INDEX IF NOT EXISTS idx_event_sources_primary_ordered
  ON event_sources (event_id, is_primary DESC, created_at);