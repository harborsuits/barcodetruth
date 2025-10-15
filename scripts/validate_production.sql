-- Production Validation Queries
-- Run these to ensure no mocks/placeholders are leaking

-- Test 1: Events used by app are all official & non-test/non-placeholder
SELECT COUNT(*) AS bad_events,
       STRING_AGG(DISTINCT be.brand_id::text, ', ') AS affected_brands
FROM brand_latest_verified_event lve
JOIN brand_events be ON be.event_id = lve.event_id
WHERE NOT (
  be.verification = 'official'
  AND COALESCE(be.is_placeholder, false) = false
  AND COALESCE(be.is_test, false) = false
  AND be.deleted_at IS NULL
);
-- Expected: bad_events = 0

-- Test 2: Evidence links exist & are http(s)
SELECT COUNT(*) AS bad_links,
       STRING_AGG(url, E'\n') AS invalid_urls
FROM brand_latest_evidence
WHERE url !~* '^https?://';
-- Expected: bad_links = 0

-- Test 3: Evidence coverage report (brands without sources)
SELECT b.name, 
       lve.event_id, 
       COUNT(e.url) AS source_count,
       s.last_event_at
FROM brand_standings s
JOIN brands b ON b.id = s.brand_id
LEFT JOIN brand_latest_verified_event lve ON lve.brand_id = s.brand_id
LEFT JOIN brand_latest_evidence e ON e.brand_id = s.brand_id
WHERE s.last_event_at IS NOT NULL  -- Only check brands with events
GROUP BY b.name, lve.event_id, s.last_event_at
HAVING COUNT(e.url) = 0
ORDER BY s.last_event_at DESC
LIMIT 20;
-- Expected: Empty or acceptable for recent events pending evidence attachment

-- Test 4: Trending list has data
SELECT COUNT(*) AS trending_count
FROM brand_trending
LIMIT 1;
-- Expected: trending_count > 0

-- Test 5: Search function works
SELECT search_entities('Unilever', 10) AS search_result;
-- Expected: Returns jsonb with brands and products arrays

-- Test 6: Brand standings have scores
SELECT COUNT(*) AS brands_with_scores,
       COUNT(*) FILTER (WHERE score IS NOT NULL) AS scored_brands,
       COUNT(*) FILTER (WHERE last_event_at IS NOT NULL) AS brands_with_events
FROM brand_standings;
-- Expected: scored_brands > 0, brands_with_events > 0
