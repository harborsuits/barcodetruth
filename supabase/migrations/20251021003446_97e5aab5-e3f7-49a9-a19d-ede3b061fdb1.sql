
-- Add categorization columns to brand_events
ALTER TABLE brand_events
  ADD COLUMN IF NOT EXISTS category_confidence numeric,
  ADD COLUMN IF NOT EXISTS secondary_categories text[],
  ADD COLUMN IF NOT EXISTS noise_reason text;

-- Add index for category_code queries
CREATE INDEX IF NOT EXISTS idx_brand_events_category_code ON brand_events(category_code) WHERE category_code IS NOT NULL;
