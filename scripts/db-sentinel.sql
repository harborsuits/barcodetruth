-- Database sentinel queries - run in CI to catch baseline leaks
-- Exit code 1 if any count > 0

-- Check 1: Trending should only have brands with events + evidence
SELECT 
  COUNT(*) AS trending_leaks,
  ARRAY_AGG(brand_id) FILTER (WHERE last_event_at IS NULL OR events_30d = 0) AS leaked_brands
FROM brand_trending
WHERE last_event_at IS NULL OR events_30d = 0;

-- Check 2: No summaries without evidence
SELECT 
  COUNT(*) AS summary_leaks,
  ARRAY_AGG(l.brand_id) FILTER (WHERE l.ai_summary_md IS NOT NULL AND e.url IS NULL) AS leaked_summaries
FROM brand_latest_verified_event l
LEFT JOIN brand_latest_evidence e ON e.brand_id = l.brand_id
WHERE l.ai_summary_md IS NOT NULL
  AND (e.url IS NULL OR e.url !~* '^https?://');

-- Check 3: brand_standings should align with verified events
SELECT 
  COUNT(*) AS standings_mismatches,
  ARRAY_AGG(s.brand_id) FILTER (
    WHERE s.score IS NOT NULL 
      AND (s.last_event_at IS NULL OR c.events_30d = 0)
  ) AS mismatched_brands
FROM brand_standings s
LEFT JOIN brand_data_coverage c ON c.brand_id = s.brand_id
WHERE s.score IS NOT NULL 
  AND (s.last_event_at IS NULL OR c.events_30d = 0);

-- Expected output: all counts should be 0
-- CI should fail if any count > 0
