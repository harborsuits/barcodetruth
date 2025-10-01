-- Pilot Health Check Dashboard
-- Run this in Supabase SQL Editor to monitor pilot performance

-- Overview: Events by day, category, and verification
SELECT 
  DATE(created_at) AS day,
  category,
  verification,
  COUNT(*) AS events,
  COUNT(DISTINCT brand_id) AS brands
FROM brand_events
WHERE created_at >= NOW() - INTERVAL '48 hours'
GROUP BY 1,2,3
ORDER BY 1 DESC, 2;

-- Source breakdown (which APIs are contributing)
SELECT 
  es.source_name,
  COUNT(*) AS articles,
  COUNT(DISTINCT be.brand_id) AS brands,
  MIN(be.created_at) AS first_seen,
  MAX(be.created_at) AS last_seen
FROM event_sources es
JOIN brand_events be ON es.event_id = be.event_id
WHERE be.created_at >= NOW() - INTERVAL '48 hours'
GROUP BY 1
ORDER BY 2 DESC;

-- Dedupe effectiveness (how many duplicates were caught)
SELECT 
  source_url,
  COUNT(*) AS duplicate_attempts
FROM brand_events
WHERE created_at >= NOW() - INTERVAL '48 hours'
GROUP BY 1
HAVING COUNT(*) > 1
ORDER BY 2 DESC
LIMIT 20;

-- Severity distribution
SELECT 
  severity,
  category,
  COUNT(*) AS events
FROM brand_events
WHERE created_at >= NOW() - INTERVAL '48 hours'
GROUP BY 1,2
ORDER BY 1,3 DESC;

-- Push notification readiness (events with coalesced jobs)
SELECT 
  be.brand_id,
  b.name,
  COUNT(DISTINCT be.event_id) AS new_events,
  COUNT(DISTINCT j.id) AS push_jobs
FROM brand_events be
JOIN brands b ON be.brand_id = b.id
LEFT JOIN jobs j ON j.payload->>'brand_id' = be.brand_id::text 
  AND j.stage = 'send_push_for_score_change'
  AND j.created_at >= be.created_at
WHERE be.created_at >= NOW() - INTERVAL '48 hours'
GROUP BY 1,2
ORDER BY 3 DESC;

-- Rate limit pressure (articles per hour per source)
SELECT 
  DATE_TRUNC('hour', be.created_at) AS hour,
  es.source_name,
  COUNT(*) AS articles_inserted
FROM brand_events be
JOIN event_sources es ON es.event_id = be.event_id
WHERE be.created_at >= NOW() - INTERVAL '48 hours'
GROUP BY 1,2
ORDER BY 1 DESC, 3 DESC;
