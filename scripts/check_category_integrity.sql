-- Category Evidence Integrity Canary
-- Run this to detect any non-canonical categories that bypassed normalization

-- Check for non-canonical categories
SELECT 
  event_id,
  brand_id,
  category::text as category,
  category_code,
  title,
  created_at
FROM brand_events
WHERE category::text NOT IN ('labor', 'environment', 'politics', 'social')
ORDER BY created_at DESC;

-- Summary stats by category
SELECT 
  category::text,
  COUNT(*) as event_count,
  COUNT(DISTINCT brand_id) as brand_count
FROM brand_events
WHERE is_irrelevant = false
GROUP BY category::text
ORDER BY event_count DESC;
