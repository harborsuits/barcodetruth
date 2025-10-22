# RSS Integration Validation Queries

Quick SQL queries to verify RSS integrations are working correctly.

## Event Flow Verification

### Check Latest RSS Events by Source

```sql
-- View latest RSS events across all three sources
SELECT 
  b.name as brand_name,
  e.title,
  e.category,
  e.verification,
  e.relevance_score_raw,
  es.source_name,
  e.source_url,
  e.created_at
FROM brand_events e
JOIN event_sources es ON es.event_id = e.event_id
JOIN brands b ON b.id = e.brand_id
WHERE es.source_name IN ('Google News', 'Reddit', 'SEC EDGAR')
  AND e.created_at > NOW() - INTERVAL '24 hours'
ORDER BY e.created_at DESC
LIMIT 30;
```

### Count Events by Source (Last 24h)

```sql
SELECT 
  es.source_name,
  COUNT(*) as event_count,
  COUNT(DISTINCT e.brand_id) as brand_count,
  MAX(e.created_at) as last_insert
FROM brand_events e
JOIN event_sources es ON es.event_id = e.event_id
WHERE e.created_at > NOW() - INTERVAL '24 hours'
  AND es.source_name IN ('Google News', 'Reddit', 'SEC EDGAR')
GROUP BY es.source_name
ORDER BY event_count DESC;
```

### View Events for Specific Brand

```sql
-- Replace BRAND_UUID with actual brand ID
SELECT 
  e.event_id,
  e.title,
  e.category,
  e.category_code,
  e.verification,
  e.relevance_score_raw,
  es.source_name,
  e.source_url,
  e.created_at
FROM brand_events e
JOIN event_sources es ON es.event_id = e.event_id
WHERE e.brand_id = 'BRAND_UUID'
  AND es.source_name IN ('Google News', 'Reddit', 'SEC EDGAR')
ORDER BY e.created_at DESC
LIMIT 20;
```

## Deduplication Verification

### Check for Duplicate Source URLs

```sql
-- Should return zero rows if deduplication is working
SELECT 
  brand_id,
  source_url,
  COUNT(*) as dupe_count,
  ARRAY_AGG(event_id) as event_ids
FROM brand_events
WHERE source_url IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY brand_id, source_url
HAVING COUNT(*) > 1
ORDER BY dupe_count DESC
LIMIT 10;
```

### Verify Unique Index Exists

```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'brand_events'
  AND indexname = 'ux_brand_events_brand_url';
```

## Source-Specific Validation

### Google News Events

```sql
-- Check Google News events
SELECT 
  e.title,
  e.category,
  e.verification,
  e.relevance_score_raw,
  e.source_url,
  es.domain_kind,
  e.created_at
FROM brand_events e
JOIN event_sources es ON es.event_id = e.event_id
WHERE es.source_name = 'Google News'
  AND e.created_at > NOW() - INTERVAL '24 hours'
ORDER BY e.created_at DESC
LIMIT 10;
```

### Reddit Events

```sql
-- Check Reddit events
SELECT 
  e.title,
  e.category,
  e.verification,
  e.relevance_score_raw,
  e.source_url,
  es.domain_kind,
  e.created_at
FROM brand_events e
JOIN event_sources es ON es.event_id = e.event_id
WHERE es.source_name = 'Reddit'
  AND e.created_at > NOW() - INTERVAL '24 hours'
ORDER BY e.created_at DESC
LIMIT 10;
```

### SEC EDGAR Events

```sql
-- Check SEC EDGAR events
SELECT 
  e.title,
  e.category,
  e.category_code,
  e.verification,
  e.relevance_score_raw,
  e.source_url,
  e.raw_data->>'filing_type' as filing_type,
  e.raw_data->>'ticker' as ticker,
  e.created_at
FROM brand_events e
JOIN event_sources es ON es.event_id = e.event_id
WHERE es.source_name = 'SEC EDGAR'
  AND e.created_at > NOW() - INTERVAL '7 days'
ORDER BY e.created_at DESC
LIMIT 10;
```

## Verification Status Checks

### Verify Correct Verification Levels

```sql
-- Should show 'official' for SEC, 'unverified' for others
SELECT 
  es.source_name,
  e.verification,
  COUNT(*) as count
FROM brand_events e
JOIN event_sources es ON es.event_id = e.event_id
WHERE es.source_name IN ('Google News', 'Reddit', 'SEC EDGAR')
  AND e.created_at > NOW() - INTERVAL '24 hours'
GROUP BY es.source_name, e.verification
ORDER BY es.source_name, e.verification;
```

### Check Relevance Score Ranges

```sql
-- Verify scores are in expected ranges
-- SEC should be 20, Google News 12-16, Reddit ~12
SELECT 
  es.source_name,
  MIN(e.relevance_score_raw) as min_score,
  AVG(e.relevance_score_raw) as avg_score,
  MAX(e.relevance_score_raw) as max_score,
  COUNT(*) as event_count
FROM brand_events e
JOIN event_sources es ON es.event_id = e.event_id
WHERE es.source_name IN ('Google News', 'Reddit', 'SEC EDGAR')
  AND e.created_at > NOW() - INTERVAL '7 days'
GROUP BY es.source_name;
```

## Ticker Mapping Validation

### Check SEC Ticker Mappings

```sql
-- View all SEC ticker mappings
SELECT 
  b.name as brand_name,
  bdm.external_id as ticker,
  bdm.created_at,
  bdm.updated_at
FROM brand_data_mappings bdm
JOIN brands b ON b.id = bdm.brand_id
WHERE bdm.source = 'sec'
  AND bdm.label = 'ticker'
ORDER BY b.name;
```

### Brands with SEC Tickers but No Recent Events

```sql
-- Identify brands with tickers but no SEC events in last 30 days
SELECT 
  b.name as brand_name,
  bdm.external_id as ticker,
  COUNT(e.event_id) as event_count_30d
FROM brand_data_mappings bdm
JOIN brands b ON b.id = bdm.brand_id
LEFT JOIN brand_events e ON e.brand_id = bdm.brand_id 
  AND e.created_at > NOW() - INTERVAL '30 days'
LEFT JOIN event_sources es ON es.event_id = e.event_id
  AND es.source_name = 'SEC EDGAR'
WHERE bdm.source = 'sec'
  AND bdm.label = 'ticker'
GROUP BY b.name, bdm.external_id
HAVING COUNT(e.event_id) = 0
ORDER BY b.name;
```

## Performance & Health Checks

### Recent Ingestion Activity

```sql
-- View ingestion activity across all brands
SELECT 
  DATE_TRUNC('hour', e.created_at) as hour,
  es.source_name,
  COUNT(*) as events_inserted
FROM brand_events e
JOIN event_sources es ON es.event_id = e.event_id
WHERE es.source_name IN ('Google News', 'Reddit', 'SEC EDGAR')
  AND e.created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour, es.source_name
ORDER BY hour DESC, es.source_name;
```

### Brands with Most RSS Events

```sql
-- Top brands by RSS event volume (last 7 days)
SELECT 
  b.name as brand_name,
  es.source_name,
  COUNT(*) as event_count
FROM brand_events e
JOIN event_sources es ON es.event_id = e.event_id
JOIN brands b ON b.id = e.brand_id
WHERE es.source_name IN ('Google News', 'Reddit', 'SEC EDGAR')
  AND e.created_at > NOW() - INTERVAL '7 days'
GROUP BY b.name, es.source_name
ORDER BY event_count DESC
LIMIT 20;
```

### Check for Stale Sources (No Events in 2+ Hours)

```sql
-- Alert if a source hasn't inserted events in 2+ hours
SELECT 
  es.source_name,
  MAX(e.created_at) as last_insert,
  EXTRACT(EPOCH FROM (NOW() - MAX(e.created_at)))/3600 as hours_since_last
FROM brand_events e
JOIN event_sources es ON es.event_id = e.event_id
WHERE es.source_name IN ('Google News', 'Reddit', 'SEC EDGAR')
GROUP BY es.source_name
HAVING MAX(e.created_at) < NOW() - INTERVAL '2 hours'
ORDER BY last_insert DESC;
```

## Category Distribution

### Event Category Breakdown by Source

```sql
SELECT 
  es.source_name,
  e.category,
  COUNT(*) as count
FROM brand_events e
JOIN event_sources es ON es.event_id = e.event_id
WHERE es.source_name IN ('Google News', 'Reddit', 'SEC EDGAR')
  AND e.created_at > NOW() - INTERVAL '7 days'
GROUP BY es.source_name, e.category
ORDER BY es.source_name, count DESC;
```

## Troubleshooting Queries

### Find Events with Missing Source Records

```sql
-- Should return zero rows
SELECT 
  e.event_id,
  e.title,
  e.source_url,
  e.created_at
FROM brand_events e
LEFT JOIN event_sources es ON es.event_id = e.event_id
WHERE e.source_url LIKE '%news.google.com%'
  OR e.source_url LIKE '%reddit.com%'
  OR e.source_url LIKE '%sec.gov%'
  AND es.id IS NULL
  AND e.created_at > NOW() - INTERVAL '7 days'
LIMIT 10;
```

### Identify Potential Canonical URL Issues

```sql
-- Find Google News redirect URLs that might need normalization
SELECT 
  e.event_id,
  e.title,
  e.source_url,
  es.canonical_url,
  e.created_at
FROM brand_events e
JOIN event_sources es ON es.event_id = e.event_id
WHERE e.source_url LIKE '%news.google.com%'
  AND es.canonical_url IS NULL
  AND e.created_at > NOW() - INTERVAL '24 hours'
LIMIT 10;
```

## Quick Test Commands

After making changes, run these to verify everything is working:

```bash
# Test all three sources for Kroger
curl -X POST "$SUPABASE_URL/functions/v1/fetch-google-news-rss?brand_id=5e7f728b-d485-43ce-b82e-ed7c606f01d2" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"

curl -X POST "$SUPABASE_URL/functions/v1/fetch-reddit-rss?brand_id=5e7f728b-d485-43ce-b82e-ed7c606f01d2" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"

curl -X POST "$SUPABASE_URL/functions/v1/fetch-sec-edgar?brand_id=5e7f728b-d485-43ce-b82e-ed7c606f01d2" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

Then run the "Check Latest RSS Events" query above to verify inserts.
