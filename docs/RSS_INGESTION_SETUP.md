# RSS Ingestion Setup

## Overview
The RSS ingestion system fetches news and filings from 3 free, no-API-key sources (Google News, Reddit, SEC EDGAR) and creates events in `brand_events` with automatic deduplication and relevance scoring.

## Edge Functions

### 1. `fetch-google-news-rss`
- **URL**: `https://news.google.com/rss/search?q={brand_name}`
- **Input**: `brand_id` (required), `dryrun=1` (optional)
- **Process**:
  1. Looks up brand name from `brands` table
  2. Fetches Google News RSS feed
  3. Parses articles using shared RSS parser
  4. Categorizes based on keywords (labor/environment/politics/social)
  5. Assigns relevance score: 16 (exact brand match) or 12 (generic)
  6. Inserts into `brand_events` with `verification='unverified'`
  7. Creates `event_sources` for attribution
- **Deduplication**: By `source_url` (canonical link)
- **Schedule**: Hourly (suggested: `:15`)

### 2. `fetch-reddit-rss`
- **URL**: `https://www.reddit.com/search.rss?q={brand_name}&sort=new`
- **Input**: `brand_id` (required), `dryrun=1` (optional)
- **Process**:
  1. Looks up brand name from `brands` table
  2. Fetches Reddit search RSS feed
  3. Parses posts using shared RSS parser
  4. Defaults to `category='social'` (good for boycotts, scandals)
  5. Assigns relevance score: 12 (social media baseline)
  6. Inserts into `brand_events` with `verification='unverified'`
  7. Creates `event_sources` with `domain_owner='Reddit'`
- **Deduplication**: By `source_url` (Reddit permalink)
- **Schedule**: Hourly (suggested: `:25`)

### 3. `fetch-sec-edgar`
- **URL**: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={ticker}`
- **Input**: `brand_id` (required), `dryrun=1` (optional)
- **Process**:
  1. Looks up ticker from `brand_data_mappings` (source='sec')
  2. Fetches SEC EDGAR Atom feed
  3. Parses filings using shared RSS parser
  4. Categorizes by filing type:
     - 8-K → `social` or `legal` (based on keywords)
     - 10-Q/10-K → `general` (financial reports)
     - DEF 14A → `politics` (proxy statements)
  5. Assigns relevance score: 20 (official government source)
  6. Inserts into `brand_events` with `verification='official'`
  7. Creates `event_sources` with `credibility_tier='official'`
- **Deduplication**: By `source_url` (filing URL)
- **Schedule**: Daily (suggested: 3am)
- **Requires**: Ticker symbol in `brand_data_mappings` table

## Shared Infrastructure

### `_shared/rssParser.ts`
- Parses both RSS 2.0 and Atom feeds
- Normalizes to common `NormalizedItem` format:
  ```typescript
  {
    title: string;
    link: string;
    published_at: string; // ISO timestamp
    source_name: string;
    summary?: string;
    author?: string;
    guid?: string;
  }
  ```
- Handles CDATA, HTML entities, date parsing
- Extracts original publisher from Google News `<source>` tag

## Database Setup

### Add SEC Tickers to `brand_data_mappings`
```sql
-- Example: Add Kroger ticker
INSERT INTO brand_data_mappings (brand_id, source, query, external_id)
VALUES (
  '<brand_uuid>',
  'sec',
  'KR',  -- Ticker symbol (query field)
  '0000056873' -- CIK number (external_id, optional)
);
```

### Ensure Unique Constraint
```sql
-- Already exists, but verify:
CREATE UNIQUE INDEX IF NOT EXISTS brand_data_mappings_unique 
ON brand_data_mappings (brand_id, source, query);
```

## Cron Scheduling

Use `pg_cron` to schedule hourly/daily ingestion:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Google News RSS (hourly at :15)
SELECT cron.schedule(
  'fetch-google-news-rss-pilot',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-google-news-rss?brand_id=<BRAND_ID>',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb
  ) as request_id;
  $$
);

-- Reddit RSS (hourly at :25)
SELECT cron.schedule(
  'fetch-reddit-rss-pilot',
  '25 * * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-reddit-rss?brand_id=<BRAND_ID>',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb
  ) as request_id;
  $$
);

-- SEC EDGAR (daily at 3am)
SELECT cron.schedule(
  'fetch-sec-edgar-pilot',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-sec-edgar?brand_id=<BRAND_ID>',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb
  ) as request_id;
  $$
);
```

## Testing

### Dry Run (no DB inserts)
```bash
# Google News RSS
curl "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-google-news-rss?brand_id=<BRAND_ID>&dryrun=1" \
  -H "Authorization: Bearer <ANON_KEY>"

# Reddit RSS
curl "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-reddit-rss?brand_id=<BRAND_ID>&dryrun=1" \
  -H "Authorization: Bearer <ANON_KEY>"

# SEC EDGAR
curl "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-sec-edgar?brand_id=<BRAND_ID>&dryrun=1" \
  -H "Authorization: Bearer <ANON_KEY>"
```

### Live Run (single brand)
```bash
# Google News RSS
curl "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-google-news-rss?brand_id=<BRAND_ID>" \
  -H "Authorization: Bearer <ANON_KEY>"

# Reddit RSS
curl "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-reddit-rss?brand_id=<BRAND_ID>" \
  -H "Authorization: Bearer <ANON_KEY>"

# SEC EDGAR
curl "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-sec-edgar?brand_id=<BRAND_ID>" \
  -H "Authorization: Bearer <ANON_KEY>"
```

## Monitoring

### Check Edge Function Logs
```bash
supabase functions logs fetch-google-news-rss
supabase functions logs fetch-reddit-rss
supabase functions logs fetch-sec-edgar
```

### Expected Output
```
Scanned: X     - Total items parsed from feed
Inserted: Y    - New events created
Skipped: Z     - Duplicates (already in DB)
```

### Query Recent Events
```sql
-- Check Google News events
SELECT title, source_url, relevance_score_raw, created_at
FROM brand_events
WHERE raw_data->>'source' = 'google_news_rss'
ORDER BY created_at DESC
LIMIT 10;

-- Check Reddit events
SELECT title, source_url, relevance_score_raw, created_at
FROM brand_events
WHERE raw_data->>'source' = 'reddit_rss'
ORDER BY created_at DESC
LIMIT 10;

-- Check SEC filings
SELECT title, source_url, category_code, created_at
FROM brand_events
WHERE raw_data->>'source' = 'sec_edgar'
ORDER BY created_at DESC
LIMIT 10;
```

## Rate Limits & Costs

**All sources are 100% free with no API keys required:**

- **Google News RSS**: Unlimited, no throttling
- **Reddit RSS**: Unlimited, no throttling
- **SEC EDGAR**: Unlimited, but respect 2-3s delay between requests

**Recommended delays:**
- Between brands: 2-3 seconds
- Between requests: 100ms (already in code)

## Relevance Scoring

| Source | Score | Reasoning |
|--------|-------|-----------|
| SEC EDGAR | 20 | Official government source, always relevant |
| Google News (exact match) | 16 | Brand name appears in headline |
| Google News (generic) | 12 | Brand mentioned in article text |
| Reddit | 12 | Community-driven, less authoritative |

**Minimum accepted score**: 11 (enforced by schema trigger)

## Categorization

Simple keyword-based categorization (can enhance with `event_rules` table later):

- **Labor**: strike, union, layoff, OSHA, wage
- **Environment**: pollution, EPA, emissions, toxic, spill
- **Politics**: lobbying, PAC, campaign, donation
- **Social**: lawsuit, recall, boycott, scandal, controversy

## Next Steps

1. **Test functions**: Run dry runs for 2-3 pilot brands
2. **Add tickers**: Insert SEC tickers into `brand_data_mappings`
3. **Set up cron**: Schedule hourly/daily jobs
4. **Monitor logs**: Watch for errors and adjust relevance thresholds
5. **Enhance categorization**: Add more keywords to `event_rules` table
6. **Enable corroboration**: Let `auto-corroborate-events` upgrade unverified → corroborated

## Troubleshooting

### No results from Google News
- Verify brand name is exact (try adding quotes: `"Nike"`)
- Check if brand name is too generic (e.g., "Apple" returns tech + fruit)

### SEC EDGAR fails
- Ensure ticker is in `brand_data_mappings` (source='sec')
- Verify ticker is valid (test manually at sec.gov)
- Check if company is public (SEC only tracks public companies)

### Reddit has too many false positives
- Brand name may be too generic
- Consider filtering by subreddit (future enhancement)

### Duplicates not being skipped
- Verify `source_url` uniqueness constraint on `brand_events`
- Check if URLs differ by query params (should be normalized)
