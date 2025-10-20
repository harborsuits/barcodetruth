# Rate-Limited News Orchestrator

## Overview
The unified news orchestrator now includes automatic API key detection and budget enforcement to prevent rate limit (429) errors while maximizing data ingestion from all available sources.

## Features
✅ **Auto-detect sources** - Only uses APIs with valid keys configured
✅ **Budget enforcement** - Tracks daily quotas in `api_rate_limits` table
✅ **Fail soft** - If one source fails/exhausted, others continue
✅ **Guardian + GDELT baseline** - Always runs (high volume, no rate limits)

## Enabled Sources

| Source | Daily Limit | Requires Key | Notes |
|--------|------------|--------------|-------|
| Guardian | 500 | Yes | Primary news source |
| GDELT | 5000 | No | Always enabled |
| NewsAPI | 100 | Yes | 24h delay on free tier |
| NYT | 500 | Yes | High quality |
| GNews | 100 | Yes | 12h delay on free tier |
| Mediastack | 16 | Yes | ~500/month ÷ 30 days |
| Currents | 20 | Yes | ~600/month ÷ 30 days |

## Cron Schedule

Run orchestrator **every 2 hours** to stay within free-tier quotas:

```sql
-- Schedule unified news orchestrator (every 2 hours)
SELECT cron.schedule(
  'unified-news-orchestrator',
  '0 */2 * * *',  -- Every 2 hours at :00
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/unified-news-orchestrator',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('mode', 'batch')
  );
  $$
);
```

## Monitoring Budget Usage

Check remaining calls per source:
```sql
SELECT 
  source,
  call_count,
  window_start,
  updated_at,
  CASE source
    WHEN 'guardian' THEN 500 - call_count
    WHEN 'newsapi' THEN 100 - call_count
    WHEN 'nyt' THEN 500 - call_count
    WHEN 'gnews' THEN 100 - call_count
    WHEN 'mediastack' THEN 16 - call_count
    WHEN 'currents' THEN 20 - call_count
    WHEN 'gdelt' THEN 5000 - call_count
  END AS remaining
FROM api_rate_limits
WHERE window_start >= date_trunc('day', now())
ORDER BY source;
```

## Health Check

Verify sources are producing data:
```sql
-- Events by source (last 24h)
SELECT 
  es.source_name,
  COUNT(*) as events,
  COUNT(DISTINCT e.brand_id) as brands
FROM event_sources es
JOIN brand_events e ON e.event_id = es.event_id
WHERE e.event_date >= now() - interval '24 hours'
  AND e.is_irrelevant = false
  AND e.relevance_score_raw >= 11
GROUP BY es.source_name
ORDER BY events DESC;
```

## Troubleshooting

### Source returning 429 (Rate Limit)
- Check budget: `SELECT * FROM api_rate_limits WHERE source = '<source_name>'`
- Reduce cron frequency (e.g., every 3 hours instead of 2)
- Wait for window reset (midnight UTC)

### Source returning 401/400 (Bad Key)
- Verify API key is set correctly in Supabase secrets
- Source will automatically skip and try again next run
- Check logs: `supabase functions logs unified-news-orchestrator`

### No articles from a source
- Verify source is in enabled list: check function logs for "Enabled sources"
- Verify brand name matches what the API expects
- Check budget hasn't been exhausted

## Architecture

```
┌─────────────────────┐
│  Cron (every 2h)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  unified-news-orchestrator          │
│  ┌─────────────────────────────┐   │
│  │ enabledSources()            │   │
│  │ - Auto-detect API keys      │   │
│  │ - Return ['guardian','gdelt',│  │
│  │   'newsapi', ...]           │   │
│  └─────────────────────────────┘   │
│                                      │
│  ┌─────────────────────────────┐   │
│  │ fetchBudgeted(source, url)  │   │
│  │ - Check api_rate_limits     │   │
│  │ - Skip if exhausted (429)   │   │
│  │ - Increment counter         │   │
│  │ - Make request              │   │
│  └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  brand_events + event_sources        │
│  (deduped, scored, categorized)      │
└──────────────────────────────────────┘
```

## Budget Management

The system automatically:
1. Checks remaining quota before each API call
2. Skips exhausted sources (returns 429)
3. Resets counters at midnight UTC
4. Continues batch even if one source fails

No manual intervention needed—orchestrator handles everything.
