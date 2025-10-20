# Ingestion Architecture

## System Overview

All data ingestion into `brand_events` follows strict relevance scoring guardrails to prevent garbage data.

## Ingestion Pathways

### 1. News Ingestion (Primary Path)
**Function**: `unified-news-orchestrator`  
**Called by**: `batch-process-brands` (automated cron)  
**Purpose**: Ingest news articles from GDELT, Guardian, NewsAPI, NYT, GNews

**Relevance Filtering**:
- ✅ Scores articles 0-20 using `scoreRelevanceStrict()`
- ✅ Only ingests articles with `relevance_score_raw >= 11`
- ✅ Sets `is_irrelevant: false` for accepted articles
- ✅ Applies brand disambiguation (Gillette Stadium ≠ Gillette razors)
- ✅ Blocks non-English articles
- ✅ Filters press releases
- ✅ Uses `RELEVANCE_MIN_ACCEPTED` constant

**Category Classification**:
- Uses `event_rules` table with 37+ pattern-matching rules
- Assigns `category_code` (FIN.INSTITUTIONAL, LEGAL.LITIGATION, etc.)
- Calculates impact scores based on category

### 2. Regulatory Data Ingestion
**Functions**: 
- `fetch-epa-events` (EPA violations)
- `fetch-osha-events` (OSHA inspections)
- `fetch-fec-events` (FEC political donations)
- `ingest-fda-recalls` (FDA product recalls)

**Called by**: 
- `bulk-ingest-epa` (manual/cron)
- `bulk-ingest-osha` (manual/cron)
- `bulk-ingest-fec` (manual/cron)
- `bulk-ingest-fda` (manual/cron)

**Relevance Handling**:
- ✅ Sets `relevance_score_raw: RELEVANCE_MAX_SCORE` (20)
- ✅ Sets `is_irrelevant: false`
- ✅ Bypasses news filtering (official government data)
- ✅ Always `verification: 'official'`

**Why max score?**
- These are official government records, not news articles
- 100% relevant by definition (tied to the brand via official records)
- No need for AI-based relevance scoring

### 3. Legacy Functions (DEPRECATED)
**Functions**:
- `fetch-guardian-news` ❌ Not called anymore
- `fetch-news-events` ❌ Not called anymore

**Status**: 
- No longer invoked by `batch-process-brands`
- Replaced by `unified-news-orchestrator`
- Can be deleted in cleanup

## Database Guardrails

### Schema-Level Protection
```sql
-- 1. Column: relevance_score_raw (source of truth)
relevance_score_raw INTEGER NOT NULL DEFAULT 0 
  CHECK (relevance_score_raw BETWEEN 0 AND 20)

-- 2. Column: relevance_score_norm (auto-generated, read-only)
relevance_score_norm NUMERIC 
  GENERATED ALWAYS AS (ROUND(relevance_score_raw / 20.0, 4)) STORED

-- 3. Trigger: Prevent 0-1 writes (catches scale mistakes)
CREATE TRIGGER trg_prevent_norm_scale
BEFORE INSERT OR UPDATE ON brand_events
FOR EACH ROW EXECUTE FUNCTION prevent_norm_scale();
```

### Constants
All functions import from `_shared/scoringConstants.ts`:
```typescript
export const RELEVANCE_MIN_ACCEPTED = 11;  // 0-20 scale
export const RELEVANCE_MAX_SCORE = 20;
export const RELEVANCE_MIN_SCORE = 0;
```

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                   CRON SCHEDULER                        │
│            (batch-process-brands runs)                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
      ┌──────────────────────────────┐
      │  unified-news-orchestrator   │
      │  • Fetches articles          │
      │  • Scores relevance (0-20)   │
      │  • Filters < 11              │
      │  • Classifies category       │
      │  • Writes to brand_events    │
      └──────────────┬───────────────┘
                     │
                     ▼
      ┌──────────────────────────────┐
      │      DATABASE GUARDRAILS      │
      │  • CHECK (0-20)               │
      │  • Trigger blocks 0-1         │
      │  • Auto-gen norm column       │
      └──────────────┬───────────────┘
                     │
                     ▼
      ┌──────────────────────────────┐
      │        brand_events           │
      │  • relevance_score_raw: 11-20 │
      │  • is_irrelevant: false       │
      │  • category_code: FIN.*, etc. │
      └───────────────────────────────┘

PARALLEL PATH (Official Data):

┌─────────────────────────────────────────────────────────┐
│              REGULATORY INGESTORS                       │
│  EPA • OSHA • FEC • FDA (manual/cron triggers)          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
      ┌──────────────────────────────┐
      │  Sets relevance_score_raw=20  │
      │  (official gov data)          │
      └──────────────┬───────────────┘
                     │
                     ▼
      ┌──────────────────────────────┐
      │      DATABASE GUARDRAILS      │
      │  (same protections)           │
      └──────────────┬───────────────┘
                     │
                     ▼
      ┌──────────────────────────────┐
      │        brand_events           │
      │  • relevance_score_raw: 20    │
      │  • verification: 'official'   │
      └───────────────────────────────┘
```

## Verification Queries

### 1. Check all paths are protected
```sql
SELECT 
  'unified-news-orchestrator' as function,
  COUNT(*) as events_ingested,
  MIN(relevance_score_raw) as min_score,
  MAX(relevance_score_raw) as max_score
FROM brand_events
WHERE verification = 'unverified'
  AND event_date >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
  'regulatory-functions',
  COUNT(*),
  MIN(relevance_score_raw),
  MAX(relevance_score_raw)
FROM brand_events
WHERE verification = 'official'
  AND event_date >= NOW() - INTERVAL '7 days';
```

### 2. Verify no garbage leaks through
```sql
-- Should return 0 rows
SELECT COUNT(*) as should_be_zero
FROM brand_events
WHERE relevance_score_raw < 11
  AND verification = 'unverified'
  AND event_date >= NOW() - INTERVAL '7 days';
```

### 3. Check scale correctness
```sql
-- Should return 0 rows (no 0-1 values)
SELECT COUNT(*) as should_be_zero
FROM brand_events
WHERE relevance_score_raw BETWEEN 0 AND 1
  AND relevance_score_raw NOT IN (0, 1);
```

## Regression Prevention

### Code Review Checklist
- [ ] All `brand_events` inserts use `relevance_score_raw` (not `relevance_score`)
- [ ] News functions use `RELEVANCE_MIN_ACCEPTED` for gating
- [ ] Regulatory functions set `relevance_score_raw: RELEVANCE_MAX_SCORE`
- [ ] No hardcoded threshold values (use constants)
- [ ] Import from `_shared/scoringConstants.ts`

### Testing Checklist
- [ ] Schema constraint prevents out-of-range values
- [ ] Trigger blocks 0-1 writes
- [ ] News orchestrator filters articles < 11
- [ ] Regulatory functions set score = 20
- [ ] No NULL values in relevance_score_raw

### Monitoring
Run these queries weekly:
```sql
-- 1. Health check
SELECT
  COUNT(*) FILTER (WHERE relevance_score_raw IS NULL) AS nulls,
  COUNT(*) FILTER (WHERE relevance_score_raw NOT BETWEEN 0 AND 20) AS out_of_range,
  COUNT(*) FILTER (WHERE relevance_score_raw < 11 AND verification = 'unverified') AS below_gate
FROM brand_events
WHERE event_date >= NOW() - INTERVAL '7 days';

-- 2. Distribution
SELECT relevance_score_raw, COUNT(*)
FROM brand_events
WHERE event_date >= NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY 1 DESC;
```

## Migration Notes

**2025-10-19**: Full system lockdown implemented
- Renamed `relevance_score` → `relevance_score_raw`
- Added `relevance_score_norm` (generated)
- Added constraint CHECK(0-20)
- Added trigger to prevent 0-1 writes
- Updated all 5 ingestion functions
- Created constants file
- Purged 240 legacy garbage events

**Result**: Zero-tolerance for irrelevant data. All paths protected.
