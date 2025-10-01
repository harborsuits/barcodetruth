# News Ingestion Setup

## Overview
The news ingestion system fetches articles from 4 sources (Guardian, NewsAPI, NYT, GNews) and creates events in `brand_events` with automatic deduplication, severity scoring, and push notifications.

## Edge Function

**`fetch-news-events`**
- **Pattern**: Follows EPA/OSHA/FEC pattern with dryrun support
- **Params**: 
  - `brand_id` (required)
  - `dryrun=1` (optional, for testing)
- **Process**:
  1. Fetches articles from all configured news APIs
  2. Dedupes by `source_url`
  3. Categorizes as "social" (lawsuit/recall/boycott) or "general"
  4. Inserts into `brand_events` with `verification='corroborated'`
  5. Creates `event_sources` for attribution
  6. Enqueues coalesced push jobs
- **Feature Flag**: `ingest_news_enabled` in `app_config`

## API Keys Required

All stored as Supabase secrets:
- `GUARDIAN_API_KEY` - The Guardian Open Platform (500 calls/day free)
- `NEWSAPI_KEY` - NewsAPI.org (100 calls/day free, 24h delay)
- `NYT_API_KEY` - NYT Developer API (500 calls/day free)
- `GNEWS_API_KEY` - GNews.io (100 calls/day free, 12h delay)

## Cron Scheduling

Schedule at **:35** (after FEC at :25) via `pg_cron`:

\`\`\`sql
-- Enable extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule news ingestion for pilot brands
SELECT cron.schedule(
  'fetch-news-events-pilot',
  '35 * * * *', -- Every hour at :35
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-news-events?brand_id=<BRAND_ID>',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb
  ) as request_id;
  $$
);
\`\`\`

## Testing

### Dry Run (no DB inserts)
\`\`\`bash
curl "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-news-events?brand_id=<BRAND_ID>&dryrun=1" \\
  -H "Authorization: Bearer <ANON_KEY>"
\`\`\`

### Live Run (single brand)
\`\`\`bash
curl "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-news-events?brand_id=<BRAND_ID>" \\
  -H "Authorization: Bearer <ANON_KEY>"
\`\`\`

## Monitoring

Check logs:
\`\`\`bash
supabase functions logs fetch-news-events
\`\`\`

Expected output:
- `Scanned: X` - Total articles fetched
- `Inserted: Y` - New events created
- `Skipped: Z` - Duplicates (already in DB)

## Quota Management

**Start with 1-2 pilot brands** to monitor:
- Guardian: 500/day ÷ 24 = ~20/hour → 20 brands max
- NewsAPI: 100/day ÷ 24 = ~4/hour → 4 brands max
- NYT: 500/day ÷ 24 = ~20/hour → 20 brands max
- GNews: 100/day ÷ 24 = ~4/hour → 4 brands max

**Recommended**: Start with 2 brands, then scale based on API response times and quota consumption.

## Severity Thresholds

Defined in `severityConfig.ts`:

```typescript
NEWS_THRESHOLDS:
  - "class action" → severe
  - "lawsuit" → moderate  
  - "recall" | "boycott" | "scandal" → moderate
  - General mentions → minor
```

## UI Features

### EventCard
- Shows news source logos (Guardian, NYT, etc.)
- Displays published date as "2h ago", "3d ago"
- Links to original article with "Read more →"
- Political context framing for relevant news

### WhyThisScore
- News chips with source attribution
- Chronological event timeline
- Category filtering (social/general)

## Troubleshooting

### No articles found
- Verify brand name matches exactly
- Check API key validity
- Review search query terms

### Rate limit errors
- Reduce cron frequency (e.g., every 2 hours)
- Remove low-priority brands
- Upgrade API plans if needed

### Duplicates not skipped
- Verify `source_url` uniqueness constraint on `brand_events`
- Check URL normalization (trailing slashes, query params)
