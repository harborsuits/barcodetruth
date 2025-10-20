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

**Budget Enforcement:** The system uses `try_spend()` RPC to atomically check and increment usage counters, preventing quota overruns.

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
WITH cfg AS (
  SELECT c.source, c.window_kind, c.limit_per_window,
         current_window_start(c.window_kind) AS win_start
  FROM api_rate_config c
),
usage AS (
  SELECT l.source, l.window_start, l.call_count
  FROM api_rate_limits l
)
SELECT cfg.source, cfg.window_kind, cfg.limit_per_window,
       COALESCE(u.call_count,0) AS used,
       (cfg.limit_per_window - COALESCE(u.call_count,0)) AS remaining,
       cfg.win_start AS window_start
FROM cfg
LEFT JOIN usage u
  ON u.source = cfg.source AND u.window_start = cfg.win_start
ORDER BY cfg.source;
```

Check recent API errors:
```sql
SELECT source, status, message, occurred_at
FROM api_error_log
ORDER BY occurred_at DESC
LIMIT 50;
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
