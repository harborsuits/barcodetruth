# Scoring System Documentation

## Relevance Scoring

### Scale & Thresholds

**Relevance scale: 0–20 (integer), minimum accepted = 11**

- **Raw Score (`relevance_score_raw`)**: Integer 0-20, source of truth
  - Stored in database
  - Used for filtering and gating
  - Minimum accepted value: 11
  
- **Normalized Score (`relevance_score_norm`)**: Decimal 0.0000-1.0000
  - Auto-generated as `raw/20.0` (STORED generated column)
  - Read-only, used for UI displays, ML features
  - Formula: `ROUND(relevance_score_raw / 20.0, 4)`

### Database Schema

```sql
-- Raw score: source of truth (0-20 integer)
relevance_score_raw INTEGER NOT NULL DEFAULT 0 
  CHECK (relevance_score_raw BETWEEN 0 AND 20)

-- Normalized score: auto-generated (0-1 decimal, read-only)
relevance_score_norm NUMERIC 
  GENERATED ALWAYS AS (ROUND(relevance_score_raw / 20.0, 4)) STORED

-- Index for efficient filtering
CREATE INDEX brand_events_rel_raw_idx 
  ON brand_events (is_irrelevant, relevance_score_raw DESC, event_date DESC);
```

### Regression Prevention

#### 1. Database Trigger (Prevents 0-1 writes)
```sql
CREATE OR REPLACE FUNCTION prevent_norm_scale()
RETURNS trigger AS $$
BEGIN
  IF NEW.relevance_score_raw BETWEEN 0 AND 1 AND NEW.relevance_score_raw <> 1 THEN
    RAISE EXCEPTION 'relevance_score_raw looks normalized (0..1). Expect 0..20.';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_norm_scale
BEFORE INSERT OR UPDATE ON brand_events
FOR EACH ROW EXECUTE FUNCTION prevent_norm_scale();
```

#### 2. Constants File
All scoring logic imports from `supabase/functions/_shared/scoringConstants.ts`:

```typescript
export const RELEVANCE_MIN_ACCEPTED = 11;  // 0-20 scale
export const RELEVANCE_MAX_SCORE = 20;
export const RELEVANCE_MIN_SCORE = 0;
```

### Ingestion Flow

1. **Scoring** (0-20 scale)
   ```typescript
   const relRaw = scoreRelevanceStrict(...); // returns 0-20
   const isIrrelevant = relRaw < RELEVANCE_MIN_ACCEPTED;
   ```

2. **Writing to DB**
   ```typescript
   await supabase.from('brand_events').upsert({
     relevance_score_raw: relRaw,  // Write 0-20 integer
     is_irrelevant: isIrrelevant,
     // ... other fields
   });
   ```

3. **Normalization** (automatic)
   - Database auto-generates `relevance_score_norm` as `raw/20.0`
   - No manual calculation needed

### Usage Guidelines

**DO:**
- ✅ Write only to `relevance_score_raw` (0-20 integer)
- ✅ Use `relevance_score_norm` for display (0-1 decimal)
- ✅ Import `RELEVANCE_MIN_ACCEPTED` constant
- ✅ Filter using `relevance_score_raw >= 11`

**DON'T:**
- ❌ Write values 0-1 to `relevance_score_raw`
- ❌ Manually set `relevance_score_norm` (it's auto-generated)
- ❌ Hardcode threshold values
- ❌ Use `relevance_score` (old column, renamed)

### Health Checks

Run these queries periodically to verify scoring integrity:

```sql
-- 1. Check for NULL or out-of-range values
SELECT
  COUNT(*) FILTER (WHERE relevance_score_raw IS NULL) AS nulls_raw,
  COUNT(*) FILTER (WHERE relevance_score_raw NOT BETWEEN 0 AND 20) AS out_of_range
FROM brand_events;

-- 2. Events below acceptance gate
SELECT COUNT(*) AS below_gate_last_24h
FROM brand_events
WHERE event_date >= NOW() - INTERVAL '24 hours'
  AND relevance_score_raw < 11;

-- 3. Distribution snapshot
SELECT relevance_score_raw, COUNT(*)
FROM brand_events
GROUP BY 1 
ORDER BY 1 DESC;

-- 4. Verify normalized consistency
SELECT event_id, relevance_score_raw, relevance_score_norm
FROM brand_events
WHERE ABS(relevance_score_norm - (relevance_score_raw / 20.0)) > 0.0001
LIMIT 10;
```

### Backfill (if needed)

If legacy data has 0-1 values instead of 0-20:

```sql
-- Detect legacy normalized values
SELECT COUNT(*) 
FROM brand_events 
WHERE relevance_score_raw BETWEEN 0 AND 1 
  AND relevance_score_raw <> 0 
  AND relevance_score_raw <> 1;

-- Fix by scaling up
UPDATE brand_events
SET relevance_score_raw = ROUND(relevance_score_raw * 20)
WHERE relevance_score_raw BETWEEN 0 AND 1
  AND relevance_score_raw <> 0
  AND relevance_score_raw <> 1;
```

## Category Scoring

### Category Score (`category_score`)

- **Range**: 0-100
- **Purpose**: Measures how strongly an article relates to its assigned category
- **Usage**: Used alongside `category_code` for impact calculation

### Impact Scores

Individual category impacts stored as integers:
- `impact_labor`: -10 to +10
- `impact_environment`: -10 to +10
- `impact_politics`: -10 to +10
- `impact_social`: -10 to +10

Combined with:
- Verification level (official: 1.4x, corroborated: 1.15x, unverified: 1.0x)
- Time decay (30d: 1.0x, 90d: 0.7x, 365d: 0.4x, older: 0.2x)

Final brand scores normalized to 0-100 range.

## Testing

### Unit Tests
Required test coverage:
1. Assert `relRaw >= 11` is only path that writes
2. Assert `relevance_score_norm === relRaw/20` (within epsilon)
3. Test trigger rejects 0-1 writes to `relevance_score_raw`

### Integration Tests
1. Ingest article → verify raw score 0-20
2. Query normalized score → verify equals raw/20
3. Attempt write with 0-1 value → verify trigger blocks it

## Migration History

- **2025-10-19**: Renamed `relevance_score` to `relevance_score_raw`
- **2025-10-19**: Added `relevance_score_norm` as generated column
- **2025-10-19**: Added constraint `CHECK (relevance_score_raw BETWEEN 0 AND 20)`
- **2025-10-19**: Added trigger `trg_prevent_norm_scale` to catch scale errors
- **2025-10-19**: Created index `brand_events_rel_raw_idx`
