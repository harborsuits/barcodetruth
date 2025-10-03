-- Verify and create critical indexes for performance
-- These are idempotent and safe to run in production

-- Index for filtering events by brand and category (used in scoring)
CREATE INDEX IF NOT EXISTS idx_brand_events_brand_category
  ON brand_events (brand_id, category);

-- Index for filtering events by brand and sorting by date (used in timeline)
CREATE INDEX IF NOT EXISTS idx_brand_events_brand_date
  ON brand_events (brand_id, event_date DESC);

-- Index for joining event sources (used in evidence retrieval)
CREATE INDEX IF NOT EXISTS idx_event_sources_event
  ON event_sources (event_id);

-- Insert default feature flags (app_config table already exists with RLS)
INSERT INTO app_config(key, value) VALUES
  ('gdelt_enabled', '{"on": true}'),
  ('dedup_enabled', '{"on": true}'),
  ('wayback_enabled', '{"on": true}')
ON CONFLICT (key) DO NOTHING;