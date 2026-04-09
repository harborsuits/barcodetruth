

# Brand Rotation + RSS Enhancement — Implementation Plan

## What This Solves

Right now the orchestrator runs every 30 minutes and tries to hit all brands with rate-limited APIs (Guardian, NYT, GNews, etc.) — burning through free-tier quotas in hours. Meanwhile, RSS feeds (21 sources, unlimited) already run every 15 minutes but aren't connected to brand-level rotation.

## What Gets Built

### 1. Brand Rotation Scheduler (new edge function)
A lightweight `rotate-brand-ingestion` function that:
- Runs **twice daily** (every 12 hours) via pg_cron
- Selects the next batch of brands to ingest, ordered by `last_news_ingestion` (oldest first)
- Processes **15-20 brands per run** (fits within free-tier API budgets)
- Calls the existing `unified-news-orchestrator` for each brand sequentially
- Updates `last_news_ingestion` after each brand completes

With 1,665 brands and 2 runs/day × 15 brands = 30 brands/day, full rotation takes ~55 days. High-priority brands (fortune_500, large) get weighted to appear more frequently.

### 2. Cron Schedule Cleanup
- **Remove**: `batch-process-brands-v2` (every 30 min) and `batch-processor-breaking` (hourly) — these are the quota burners
- **Add**: `rotate-brand-ingestion` at `0 */12 * * *` (every 12 hours)
- **Keep**: `pull-feeds-15m` (RSS is unlimited and already works)

### 3. RSS → Brand Event Linking (enhancement)
Currently RSS items land in `rss_items` and get processed by `brand-match`. Verify this pipeline actually creates `brand_events` from RSS items — if not, add the bridge so RSS becomes a real unlimited data source for brand scoring.

## Architecture

```text
Every 15 min (unchanged):
  pull-feeds → rss_items → brand-match → brand_events

Every 12 hours (NEW):
  rotate-brand-ingestion
    → pick 15-20 brands (oldest last_news_ingestion first)
    → for each: call unified-news-orchestrator
    → API-keyed sources stay within daily budgets
    → GDELT always runs (unlimited)
```

## API Budget Math (12h schedule)

| Source | Daily Limit | 2 runs × 15 brands = 30 calls | Status |
|--------|------------|-------------------------------|--------|
| Guardian | 500 | 30 | ✅ ~6% used |
| GDELT | 5000 | 30 | ✅ trivial |
| NewsAPI | 100 | 30 | ✅ ~30% used |
| NYT | 500 | 30 | ✅ ~6% used |
| GNews | 100 | 30 | ✅ ~30% used |
| Mediastack | 16 | 16 (capped) | ✅ budget-aware |
| Currents | 20 | 20 (capped) | ✅ budget-aware |

All sources stay well within free-tier limits.

## Files Changed

| File | Action |
|------|--------|
| `supabase/functions/rotate-brand-ingestion/index.ts` | **New** — rotation scheduler (~120 lines) |
| SQL via insert tool | Remove old cron jobs, add new 12h cron |
| Possibly `supabase/functions/pull-feeds/index.ts` | Verify RSS→brand_events pipeline works end-to-end |

## Priority Weighting Logic

```text
SELECT id, name, last_news_ingestion
FROM brands
WHERE is_active = true
ORDER BY
  CASE company_size
    WHEN 'fortune_500' THEN 1
    WHEN 'large' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  last_news_ingestion ASC NULLS FIRST
LIMIT 20;
```

Fortune 500 brands get checked every ~2 weeks; smaller brands every ~2 months. All brands eventually get covered.

## Safety

- Existing `unified-news-orchestrator` is untouched — rotation just calls it
- `fetchBudgeted` + `try_spend` still enforce per-source limits
- 15-minute cooldown slots prevent duplicate runs
- RSS pipeline continues independently (unlimited)
- If rotation function fails, nothing breaks — brands just wait for next run

