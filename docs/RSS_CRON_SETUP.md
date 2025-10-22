# RSS Ingestion Cron Setup

This document provides the SQL commands to schedule the RSS ingestion functions using `pg_cron`.

## Prerequisites

Ensure `pg_cron` extension is enabled:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

## Environment Variables

All cron jobs use these environment variables (automatically available in Supabase):
- `SUPABASE_URL`: Your project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for authenticated calls

## Cron Schedule Commands

### 1. Google News RSS (Hourly)

Runs every hour at :05 to fetch news from Google News RSS for all active brands.

```sql
SELECT cron.schedule(
  'rss-google-news-hourly',
  '5 * * * *', -- Every hour at :05
  $$
  SELECT
    net.http_post(
      url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-google-news-rss',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := json_build_object('brand_id', b.id)::text
    ) as request_id
  FROM brands b
  WHERE b.is_active = true
    AND b.is_test = false
  LIMIT 20; -- Process 20 brands per hour to stay within rate limits
  $$
);
```

### 2. Reddit RSS (Hourly)

Runs every hour at :25 to fetch discussions from Reddit RSS for all active brands.

```sql
SELECT cron.schedule(
  'rss-reddit-hourly',
  '25 * * * *', -- Every hour at :25
  $$
  SELECT
    net.http_post(
      url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-reddit-rss',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := json_build_object('brand_id', b.id)::text
    ) as request_id
  FROM brands b
  WHERE b.is_active = true
    AND b.is_test = false
  LIMIT 20; -- Process 20 brands per hour
  $$
);
```

### 3. SEC EDGAR (Daily)

Runs once daily at 8 AM UTC to fetch SEC filings for brands with ticker symbols.

```sql
SELECT cron.schedule(
  'rss-sec-edgar-daily',
  '0 8 * * *', -- Daily at 8:00 AM UTC
  $$
  SELECT
    net.http_post(
      url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-sec-edgar',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := json_build_object('brand_id', b.brand_id)::text
    ) as request_id
  FROM brand_data_mappings b
  WHERE b.source = 'sec'
    AND b.key = 'ticker'
  LIMIT 50; -- Process up to 50 tickers per day
  $$
);
```

## Monitoring Cron Jobs

### View Scheduled Jobs

```sql
SELECT * FROM cron.job ORDER BY jobname;
```

### View Recent Job Runs

```sql
SELECT 
  job.jobname,
  job_run_details.status,
  job_run_details.start_time,
  job_run_details.end_time,
  job_run_details.return_message
FROM cron.job_run_details
JOIN cron.job ON job.jobid = job_run_details.jobid
WHERE job.jobname IN ('rss-google-news-hourly', 'rss-reddit-hourly', 'rss-sec-edgar-daily')
ORDER BY start_time DESC
LIMIT 20;
```

### Check Recent Events Inserted

```sql
-- Google News events
SELECT COUNT(*), MAX(created_at) as last_insert
FROM brand_events
WHERE source_url LIKE '%news.google.com%'
  AND created_at > NOW() - INTERVAL '24 hours';

-- Reddit events
SELECT COUNT(*), MAX(created_at) as last_insert
FROM brand_events
WHERE source_url LIKE '%reddit.com%'
  AND created_at > NOW() - INTERVAL '24 hours';

-- SEC EDGAR events
SELECT COUNT(*), MAX(created_at) as last_insert
FROM brand_events be
JOIN event_sources es ON be.event_id = es.event_id
WHERE es.source_name = 'SEC EDGAR'
  AND be.created_at > NOW() - INTERVAL '24 hours';
```

## Removing Cron Jobs

If you need to remove any cron job:

```sql
SELECT cron.unschedule('rss-google-news-hourly');
SELECT cron.unschedule('rss-reddit-hourly');
SELECT cron.unschedule('rss-sec-edgar-daily');
```

## Rate Limiting Considerations

- **Google News RSS**: Free, no API key required. Limit: 20 brands/hour = 480 brands/day
- **Reddit RSS**: Free, no API key required. Limit: 20 brands/hour = 480 brands/day
- **SEC EDGAR**: Free government data. Limit: 50 brands/day

All sources respect 2-3 second delays between requests within each edge function to avoid rate limiting.

## Troubleshooting

### Job Not Running

1. Check if pg_cron extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Verify job schedule syntax:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'your-job-name';
   ```

### No Events Being Inserted

1. Check edge function logs in Supabase dashboard
2. Verify brand_data_mappings has ticker symbols for SEC EDGAR
3. Run manual test with dryrun=1 to see what would be inserted

### Duplicate Events

The unique index `ux_brand_events_brand_url` prevents duplicate events by (brand_id, source_url). If duplicates occur, check:
- Are source URLs being normalized consistently?
- Is the index present? `\d brand_events` in psql

## Next Steps

After setting up cron jobs:
1. Monitor for 24 hours to ensure jobs are running
2. Check event counts to verify data is flowing
3. Review UI to ensure source chips display correctly
4. Consider adding more brands to brand_data_mappings for SEC coverage
