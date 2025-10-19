-- Harden relevance filtering system with indexes and constraints

-- Ensure brands.monitoring_config exists with defaults
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS monitoring_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- GIN index for fast JSONB queries on monitoring_config
CREATE INDEX IF NOT EXISTS brands_monitoring_config_gin
  ON brands USING GIN (monitoring_config jsonb_path_ops);

-- Ensure brand_events has relevance columns
ALTER TABLE brand_events
  ADD COLUMN IF NOT EXISTS relevance_score NUMERIC,
  ADD COLUMN IF NOT EXISTS relevance_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_irrelevant BOOLEAN NOT NULL DEFAULT FALSE;

-- Performance indexes for brand_events
CREATE INDEX IF NOT EXISTS brand_events_brand_date_idx 
  ON brand_events (brand_id, event_date DESC);

CREATE INDEX IF NOT EXISTS brand_events_irrel_score_idx 
  ON brand_events (is_irrelevant, relevance_score)
  WHERE is_irrelevant = false;

-- Set safe defaults for all existing brands
UPDATE brands
SET monitoring_config = jsonb_strip_nulls(
  COALESCE(monitoring_config, '{}'::jsonb) ||
  jsonb_build_object(
    'min_score', 0.5,
    'exclude_regex', '[]'::jsonb,
    'allow_domains', '[]'::jsonb,
    'block_domains', '[]'::jsonb
  )
)
WHERE monitoring_config IS NULL OR NOT (monitoring_config ? 'min_score');

-- Add helpful comments
COMMENT ON COLUMN brands.monitoring_config IS 
'Per-brand relevance filtering config: {min_score: 0-1, exclude_regex: string[], allow_domains: string[], block_domains: string[]}';

COMMENT ON COLUMN brand_events.relevance_score IS 
'Computed relevance score (0-1) from news orchestrator';

COMMENT ON COLUMN brand_events.relevance_reason IS 
'Short code explaining score/decision: title_match|business_context|proximity_match|purged_score:X';

COMMENT ON COLUMN brand_events.is_irrelevant IS 
'Marked as irrelevant by filter or purge job; excluded from displays';