-- Add monitoring_config to brands table for per-brand customization
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS monitoring_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN brands.monitoring_config IS 'Per-brand relevance config: exclude_regex, min_score, allow_domains, block_domains';

CREATE INDEX IF NOT EXISTS brands_monitoring_config_gin
  ON brands USING GIN (monitoring_config jsonb_path_ops);

-- Add relevance tracking to brand_events for auditing and purging
ALTER TABLE brand_events
  ADD COLUMN IF NOT EXISTS relevance_score NUMERIC,
  ADD COLUMN IF NOT EXISTS relevance_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_irrelevant BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN brand_events.relevance_score IS 'Computed relevance score 0-1 from article filter';
COMMENT ON COLUMN brand_events.relevance_reason IS 'Why this article was accepted/rejected (for audits)';
COMMENT ON COLUMN brand_events.is_irrelevant IS 'Marked as irrelevant by purge job';

-- Fast scans by brand/date for purge operations
CREATE INDEX IF NOT EXISTS brand_events_brand_date_idx
  ON brand_events (brand_id, event_date DESC);

-- Index for finding irrelevant articles
CREATE INDEX IF NOT EXISTS brand_events_irrelevant_idx
  ON brand_events (is_irrelevant) WHERE is_irrelevant = true;