# RSS Integration Testing Guide

This guide walks through testing the new RSS ingestion functions before enabling cron automation.

## Quick Test Commands

Replace `BRAND_ID` with an actual brand UUID from your database.

### 1. Google News RSS Test

**Dry Run (no database writes):**
```bash
curl -X POST "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-google-news-rss?brand_id=5e7f728b-d485-43ce-b82e-ed7c606f01d2&dryrun=1" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Live Run:**
```bash
curl -X POST "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-google-news-rss?brand_id=5e7f728b-d485-43ce-b82e-ed7c606f01d2" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Expected Output:**
```json
{
  "success": true,
  "brand_id": "5e7f728b-d485-43ce-b82e-ed7c606f01d2",
  "brand_name": "Kroger",
  "scanned": 15,
  "inserted": 12,
  "skipped": 3,
  "dryrun": false
}
```

### 2. Reddit RSS Test

**Dry Run:**
```bash
curl -X POST "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-reddit-rss?brand_id=5e7f728b-d485-43ce-b82e-ed7c606f01d2&dryrun=1" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Live Run:**
```bash
curl -X POST "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-reddit-rss?brand_id=5e7f728b-d485-43ce-b82e-ed7c606f01d2" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Expected Output:**
```json
{
  "success": true,
  "brand_id": "5e7f728b-d485-43ce-b82e-ed7c606f01d2",
  "brand_name": "Kroger",
  "scanned": 10,
  "inserted": 8,
  "skipped": 2,
  "dryrun": false
}
```

### 3. SEC EDGAR Test

**Prerequisites:** Brand must have a ticker in brand_data_mappings:
```sql
SELECT * FROM brand_data_mappings 
WHERE brand_id = '5e7f728b-d485-43ce-b82e-ed7c606f01d2' 
  AND source = 'sec' 
  AND key = 'ticker';
```

**Dry Run:**
```bash
curl -X POST "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-sec-edgar?brand_id=5e7f728b-d485-43ce-b82e-ed7c606f01d2&dryrun=1" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Live Run:**
```bash
curl -X POST "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-sec-edgar?brand_id=5e7f728b-d485-43ce-b82e-ed7c606f01d2" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Expected Output:**
```json
{
  "success": true,
  "brand_id": "5e7f728b-d485-43ce-b82e-ed7c606f01d2",
  "brand_name": "Kroger",
  "ticker": "KR",
  "scanned": 50,
  "inserted": 5,
  "skipped": 45,
  "dryrun": false
}
```

## Verification Queries

### Check Inserted Events

**Google News:**
```sql
SELECT 
  event_id,
  title,
  category,
  verification,
  relevance_score_raw,
  source_url,
  created_at
FROM brand_events
WHERE brand_id = '5e7f728b-d485-43ce-b82e-ed7c606f01d2'
  AND source_url LIKE '%news.google.com%'
ORDER BY created_at DESC
LIMIT 10;
```

**Reddit:**
```sql
SELECT 
  event_id,
  title,
  category,
  verification,
  relevance_score_raw,
  source_url,
  created_at
FROM brand_events
WHERE brand_id = '5e7f728b-d485-43ce-b82e-ed7c606f01d2'
  AND source_url LIKE '%reddit.com%'
ORDER BY created_at DESC
LIMIT 10;
```

**SEC EDGAR:**
```sql
SELECT 
  be.event_id,
  be.title,
  be.category,
  be.verification,
  be.relevance_score_raw,
  be.source_url,
  be.created_at,
  es.source_name
FROM brand_events be
JOIN event_sources es ON be.event_id = es.event_id
WHERE be.brand_id = '5e7f728b-d485-43ce-b82e-ed7c606f01d2'
  AND es.source_name = 'SEC EDGAR'
ORDER BY be.created_at DESC
LIMIT 10;
```

### Check Event Sources

```sql
SELECT 
  es.source_name,
  es.canonical_url,
  es.source_date,
  es.domain_kind,
  es.credibility_tier,
  e.title
FROM event_sources es
JOIN brand_events e ON es.event_id = e.event_id
WHERE e.brand_id = '5e7f728b-d485-43ce-b82e-ed7c606f01d2'
  AND es.source_name IN ('Google News', 'Reddit', 'SEC EDGAR')
ORDER BY es.created_at DESC
LIMIT 20;
```

## Expected Results by Source

### Google News
- **Verification**: `unverified`
- **Relevance Score**: 12-16 (higher if brand name in title)
- **Category**: Keyword-based (labor, environment, politics, social)
- **Source Name**: "Google News" (with original outlet if available)
- **Domain Kind**: Should reflect original publisher

### Reddit
- **Verification**: `unverified`
- **Relevance Score**: 12 (fixed)
- **Category**: Primarily `social`, with keyword overrides
- **Source Name**: "Reddit"
- **Domain Kind**: `social_media`

### SEC EDGAR
- **Verification**: `official`
- **Relevance Score**: 20 (highest possible)
- **Category**: Based on filing type (8-K → legal/social, 10-Q/10-K → financial, DEF 14A → governance)
- **Source Name**: "SEC EDGAR"
- **Domain Kind**: `official`

## Common Issues & Solutions

### Issue: "Brand not found"
**Solution:** Verify the brand UUID exists:
```sql
SELECT id, name FROM brands WHERE id = 'YOUR_BRAND_ID';
```

### Issue: "No ticker found" (SEC EDGAR only)
**Solution:** Add ticker to brand_data_mappings:
```sql
INSERT INTO brand_data_mappings (brand_id, source, key, value)
VALUES ('YOUR_BRAND_ID', 'sec', 'ticker', 'TICKER_SYMBOL')
ON CONFLICT (brand_id, source, key) DO UPDATE SET value = EXCLUDED.value;
```

### Issue: Duplicate events error
**Solution:** The unique index `ux_brand_events_brand_url` prevents duplicates. This is expected behavior. Check:
```sql
SELECT brand_id, source_url, COUNT(*) 
FROM brand_events 
WHERE brand_id = 'YOUR_BRAND_ID'
GROUP BY brand_id, source_url 
HAVING COUNT(*) > 1;
```

### Issue: No articles returned
**Possible causes:**
1. Brand name is too generic (add more specific aliases)
2. No recent news for this brand
3. RSS feed temporarily unavailable

**Debug:** Check function logs in Supabase dashboard for detailed error messages

## UI Verification

After inserting events, check the UI:

1. **Brand Profile Page** → Events should show with source chips
2. **Evidence Cards** → Should display:
   - Source name (Google News, Reddit, SEC EDGAR)
   - Verification badge (Official for SEC, Unverified for News/Reddit)
   - Source attribution with logos

3. **InlineSources Component** → Should show:
   - Source name with proper colors
   - Credibility tier badges
   - Links to original sources

## Performance Benchmarks

Expected processing times:
- **Google News RSS**: 2-5 seconds per brand
- **Reddit RSS**: 2-5 seconds per brand  
- **SEC EDGAR**: 5-10 seconds per brand (larger feeds)

## Next Steps

Once all tests pass:
1. ✅ Verify database has correct data
2. ✅ Check UI displays sources correctly
3. ✅ Set up cron jobs (see `RSS_CRON_SETUP.md`)
4. ✅ Monitor for 24 hours
5. ✅ Expand to more brands as needed
