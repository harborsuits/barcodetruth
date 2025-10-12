-- Add link_kind enum to distinguish article vs database vs homepage
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'link_kind') THEN
    CREATE TYPE link_kind AS ENUM ('article','database','homepage');
  END IF;
END$$;

ALTER TABLE event_sources
ADD COLUMN IF NOT EXISTS link_kind link_kind;

-- Backfill link_kind based on current data (with proper casting)
UPDATE event_sources
SET link_kind = (CASE
  WHEN canonical_url IS NOT NULL AND canonical_url !~* '^(https?://)?[^/]+/?$' THEN 'article'
  WHEN credibility_tier = 'official' AND (source_url IS NOT NULL OR archive_url IS NOT NULL) THEN 'database'
  ELSE 'homepage'
END)::link_kind;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_event_sources_link_kind ON event_sources(link_kind);

-- Add constraint: link_kind must match the actual data
ALTER TABLE event_sources
DROP CONSTRAINT IF EXISTS chk_evt_src_link_kind;

ALTER TABLE event_sources
ADD CONSTRAINT chk_evt_src_link_kind
CHECK (
  (link_kind = 'article' AND canonical_url IS NOT NULL AND canonical_url !~* '^(https?://)?[^/]+/?$')
  OR (link_kind = 'database')
  OR (link_kind = 'homepage')
  OR (link_kind IS NULL)
);