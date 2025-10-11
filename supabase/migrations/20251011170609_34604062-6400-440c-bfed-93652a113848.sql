-- Add performance indexes for evidence tracking
CREATE INDEX IF NOT EXISTS idx_event_sources_canonical ON event_sources(canonical_url) WHERE canonical_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_sources_archive ON event_sources(archive_url) WHERE archive_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_sources_day ON event_sources(day_bucket);
CREATE INDEX IF NOT EXISTS idx_event_sources_event ON event_sources(event_id);