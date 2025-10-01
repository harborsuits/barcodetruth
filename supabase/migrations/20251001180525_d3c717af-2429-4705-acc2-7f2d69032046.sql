-- 1. Timestamp consistency: event_date is canonical, add computed occurred_at for compatibility
ALTER TABLE brand_events 
ADD COLUMN IF NOT EXISTS occurred_at timestamptz
  GENERATED ALWAYS AS (COALESCE(event_date, created_at)) STORED;

-- 2. Robust dedupe: unique constraint on brand + source URL
ALTER TABLE brand_events ADD COLUMN IF NOT EXISTS source_url text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_event_source
  ON brand_events (brand_id, source_url)
  WHERE source_url IS NOT NULL;

-- 3. Indexes for Phase 2 queries
CREATE INDEX IF NOT EXISTS idx_brand_events_brand_time
  ON brand_events (brand_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_brand_events_brand_occurred
  ON brand_events (brand_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_sources_url
  ON event_sources (source_url);

CREATE INDEX IF NOT EXISTS idx_event_sources_event_id
  ON event_sources (event_id);

-- 4. Add index for impact-based queries (for "Why this score?")
CREATE INDEX IF NOT EXISTS idx_brand_events_impact
  ON brand_events (brand_id, event_date DESC) 
  WHERE impact_environment < 0 OR impact_labor < 0 OR impact_politics < 0 OR impact_social < 0;