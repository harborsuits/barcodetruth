# Brand Data Coverage - Materialized View Refresh

## Overview
The `brand_data_coverage` materialized view aggregates event counts, verification rates, and source diversity for all brands. It powers the confidence-weighted scoring system.

## Manual Refresh
To manually refresh the materialized view:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY brand_data_coverage;
```

## Automated Nightly Refresh
The system includes an edge function `refresh-coverage-cache` that should be called nightly via cron.

### Setup Cron Job
Add this to your Supabase SQL editor:

```sql
SELECT cron.schedule(
  'refresh-coverage-nightly',
  '0 2 * * *', -- 2 AM daily
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/refresh-coverage-cache',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) as request_id;
  $$
);
```

Replace `YOUR_ANON_KEY` with your actual anon key.

## Monitoring
Check the edge function logs to verify the refresh is running:
- Look for `[refresh-coverage-cache] Successfully refreshed coverage cache`
- Monitor for any errors in the logs

## Impact
Refreshing this view ensures:
- Trending lists prioritize brands with recent activity
- Confidence scores reflect current data quality
- Performance remains fast (materialized view = pre-computed)
