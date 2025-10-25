-- Category Evidence Integrity: Canonical categories only
-- Prevent cross-category contamination at database level

-- 1) Performance index for common query path (brand + category + date)
CREATE INDEX IF NOT EXISTS brand_events_brand_cat_dt_idx
  ON brand_events (brand_id, category, event_date DESC)
  WHERE is_irrelevant = false AND category IS NOT NULL;

-- 2) Backfill: Normalize any non-canonical categories (one-time safety)
-- Cast enum to text for comparison
UPDATE brand_events
SET category = CASE
  WHEN category::text ILIKE 'labor%' THEN 'labor'::event_category
  WHEN category::text ILIKE 'env%' THEN 'environment'::event_category
  WHEN category::text ILIKE 'politic%' THEN 'politics'::event_category
  WHEN category::text ILIKE 'social%' THEN 'social'::event_category
  ELSE 'social'::event_category
END
WHERE category::text NOT IN ('labor', 'environment', 'politics', 'social');