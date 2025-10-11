-- Add canonical URL and classification columns to event_sources
ALTER TABLE event_sources
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS is_generic boolean
    GENERATED ALWAYS AS (
      (canonical_url IS NOT NULL AND canonical_url ~* '^(https?://)?[^/]+/?$')
      OR (source_url IS NOT NULL AND source_url ~* '^(https?://)?[^/]+/?$')
      OR coalesce(source_url,'') ~* '(press|about|news|index|landing)'
    ) STORED;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_event_sources_generic ON event_sources(is_generic) WHERE is_generic = true;