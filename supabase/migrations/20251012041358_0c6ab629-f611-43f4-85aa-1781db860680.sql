-- Ensure link_kind enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='link_kind') THEN
    CREATE TYPE link_kind AS ENUM ('article','database','homepage');
  END IF;
END$$;

-- Add column if not exists
ALTER TABLE event_sources
  ADD COLUMN IF NOT EXISTS link_kind link_kind;

-- Backfill with precise logic: article → database → homepage
-- 1) Article: we have a canonical URL
UPDATE event_sources
SET link_kind = 'article'
WHERE canonical_url IS NOT NULL
  AND (link_kind IS NULL OR link_kind != 'article');

-- 2) Database: official record but no canonical
UPDATE event_sources
SET link_kind = 'database'
WHERE link_kind IS NULL
  AND canonical_url IS NULL
  AND credibility_tier = 'official'
  AND COALESCE(source_url, archive_url) IS NOT NULL;

-- 3) Homepage: everything else (generic landing pages)
UPDATE event_sources
SET link_kind = 'homepage'
WHERE link_kind IS NULL;

-- Add constraint to prevent regressions
ALTER TABLE event_sources
DROP CONSTRAINT IF EXISTS chk_evt_src_link_kind;

ALTER TABLE event_sources
ADD CONSTRAINT chk_evt_src_link_kind CHECK (
  (link_kind = 'article'  AND canonical_url IS NOT NULL) OR
  (link_kind = 'database' AND canonical_url IS NULL) OR
  (link_kind = 'homepage')
);

-- Helpful partial indexes for queries
CREATE INDEX IF NOT EXISTS es_article_idx
  ON event_sources (event_id, source_name)
  WHERE link_kind = 'article';

CREATE INDEX IF NOT EXISTS es_database_idx
  ON event_sources (event_id, source_name)
  WHERE link_kind = 'database';

CREATE INDEX IF NOT EXISTS es_homepage_idx
  ON event_sources (event_id, source_name)
  WHERE link_kind = 'homepage';

CREATE INDEX IF NOT EXISTS es_to_summarize_idx
  ON event_sources (credibility_tier, ai_summary_updated_at)
  WHERE link_kind='article' AND ai_summary IS NULL;