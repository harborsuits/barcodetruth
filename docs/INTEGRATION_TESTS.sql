-- Integration Tests for News Ingestion Pipeline
-- Run these queries in Supabase SQL Editor after smoke tests

-- ========================================
-- 1) Recent news events (verify normalized URLs + sources saved)
-- ========================================
SELECT 
  be.event_id, 
  be.brand_id, 
  be.category, 
  be.source_url, 
  be.created_at, 
  es.source_name
FROM brand_events be
LEFT JOIN event_sources es ON es.event_id = be.event_id
WHERE be.created_at >= NOW() - INTERVAL '24 hours'
  AND be.category IN ('social','general')
ORDER BY be.created_at DESC
LIMIT 50;

-- Expected: source_url has no query params, no trailing slash, no hash
-- Expected: event_sources.source_name is populated (Guardian, NewsAPI, etc.)


-- ========================================
-- 2) Dedupe check: no two rows with same brand_id + source_url in last day
-- ========================================
SELECT 
  brand_id, 
  source_url, 
  COUNT(*) AS duplicate_count
FROM brand_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY 1, 2
HAVING COUNT(*) > 1;

-- Expected: ZERO rows (no duplicates)


-- ========================================
-- 3) Verify normalized URLs (spot check)
-- ========================================
SELECT 
  source_url,
  CASE 
    WHEN source_url LIKE '%?%' THEN '❌ Has query params'
    WHEN source_url LIKE '%#%' THEN '❌ Has hash'
    WHEN source_url LIKE '%/' THEN '❌ Has trailing slash'
    ELSE '✅ Clean'
  END AS url_status
FROM brand_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND category IN ('social', 'general')
LIMIT 100;

-- Expected: All rows should show '✅ Clean'


-- ========================================
-- 4) Coalesced push jobs created for news events
-- ========================================
SELECT 
  j.id,
  j.stage,
  j.coalesce_key,
  j.payload->>'brand_id' AS brand_id,
  j.payload->>'brand_name' AS brand_name,
  j.created_at,
  j.attempts,
  j.last_error
FROM jobs j
WHERE j.stage = 'send_push_for_score_change'
  AND j.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY j.created_at DESC
LIMIT 20;

-- Expected: Jobs exist with coalesce_key pattern 'brand_id:bucket_sec'
-- Expected: payload contains brand_id, brand_name, events array


-- ========================================
-- 5) Event sources attribution (all events have at least one source)
-- ========================================
SELECT 
  be.event_id,
  be.title,
  COUNT(es.id) AS source_count,
  STRING_AGG(es.source_name, ', ') AS sources
FROM brand_events be
LEFT JOIN event_sources es ON es.event_id = be.event_id
WHERE be.created_at >= NOW() - INTERVAL '24 hours'
  AND be.category IN ('social', 'general')
GROUP BY be.event_id, be.title
HAVING COUNT(es.id) = 0;

-- Expected: ZERO rows (all events should have at least one source)


-- ========================================
-- 6) Circuit breaker effectiveness (check logs for source failures)
-- ========================================
-- This is a manual check - look for log patterns like:
-- "[fetch-news-events] Guardian error (1 fails)"
-- "[fetch-news-events] Guardian error (2 fails)"
-- "[fetch-news-events] Guardian error (3 fails)"
-- After 3 fails, Guardian should be skipped for rest of invocation

-- You can't query logs via SQL, but you can check edge function logs:
-- https://supabase.com/dashboard/project/midmvcwtywnexzdwbekp/logs/edge-functions


-- ========================================
-- 7) Timeout detection (manual log check)
-- ========================================
-- Look for error messages like:
-- "Timeout after 8000ms"
-- These indicate fetchWithTimeout is working correctly
