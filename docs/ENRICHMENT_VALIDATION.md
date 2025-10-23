# Enrichment System Validation Guide

## Production Acceptance Checklist

### ✅ Uniform UI

- [ ] **Key People + Shareholders cards** always render (never hidden)
- [ ] **Rows always show** source, as-of/updated, and freshness pill
- [ ] **Empty states + skeletons** are identical site-wide
- [ ] **Parent/filings fallback** visible via subtle "via parent/filing" tag

### ✅ Pipelines

- [ ] **Batch fn + Cron** both acquire/release locks correctly
- [ ] **Exponential backoff** kicks in on 429/5xx; no hard failures on brief outages
- [ ] **Idempotent upserts** (no dup companies, mappings, or ownership)
- [ ] **Ledger tables** fill on every run with per-item results
- [ ] **Circuit breaker** triggers after 5 consecutive 429s, aborts remaining items

### ✅ Coverage

- [ ] **"Needs enrichment" count** now correct (fixed nullish math bug)
- [ ] **Staleness** shows realistic numbers (≥0, not drifting)
- [ ] **Stale brands** prioritized by `get_next_brands_fair_rotation`

## DB Smoke Checks

Run the queries in `scripts/validate_enrichment.sql`:

```bash
# In Supabase SQL Editor or via psql
psql -f scripts/validate_enrichment.sql
```

### Expected Results

1. **Missing Mappings**: 0 rows (all brands with QIDs should have mappings)
2. **Missing Ownership**: Low count (only brands without parents)
3. **Coverage Snapshot**: Should show >80% with people, >50% with shareholders
4. **Recent Runs**: All runs should show >90% success rate
5. **Hot Errors**: Should be empty or show transient issues only
6. **Lock Hygiene**: Should be empty (no stuck locks)
7. **Staleness**: Most brands in "fresh_7d" or "stale_7_14d" buckets
8. **Quality Spot Check**: Pick 3 brands and verify in UI
9. **No Duplicate Companies**: 0 rows
10. **No Duplicate Ownership**: 0 rows

## API/RPC Sanity

Test the resolver functions directly:

```sql
-- Pick any brand_id from a page you checked
SELECT * FROM get_brand_company_info('BRAND_UUID_HERE');
```

**Expected**: Returns company info, ownership, people, valuation (if available)

## UI Spot-Checks (2 minutes)

Load 3 brands with different data profiles:

### 1. Fully Enriched Brand (e.g., Walmart)
- ✅ Parent company shows in Ownership card
- ✅ Key People shows CEO, Chairperson, Founder
- ✅ Shareholders shows top 5 institutional holders
- ✅ All rows show source + dates + freshness pills
- ✅ Sorting: shareholders by percent desc, people by seniority

### 2. Parent-Only Brand (e.g., Chobani after enrichment)
- ✅ Both cards render (no hidden sections)
- ✅ Key People shows "via parent company" tag
- ✅ Shareholders shows "via parent company" tag or empty state
- ✅ Empty states are identical to other brands

### 3. Brand with No Data
- ✅ Both cards render with proper empty states
- ✅ Empty state text: "No verified key people yet — we'll show parent data or filings as soon as they're available."
- ✅ Empty state height matches other empty states
- ✅ No layout shift between loading → empty state

## Observability Quick Glance

### Recent Runs
```sql
SELECT * FROM enrichment_runs 
ORDER BY started_at DESC 
LIMIT 5;
```

**Look for**:
- ✅ `finished_at` is set (not NULL = stuck run)
- ✅ `succeeded` > `failed` (success rate >80%)
- ✅ No runs with `aborted = true` unless legitimate rate limiting

### Hot Errors
```sql
SELECT brand_name, error
FROM enrichment_run_items
WHERE status = 'error'
ORDER BY run_id DESC
LIMIT 20;
```

**Look for**:
- ❌ Repeated "Wikidata entity not found" → QID is invalid, needs cleanup
- ❌ "429 Rate Limit" → Circuit breaker should have triggered
- ✅ Occasional timeouts → Expected, will retry on next run

### Lock Hygiene
```sql
SELECT * FROM enrichment_job_locks;
```

**Should be empty** outside of active runs. If stuck:
```sql
DELETE FROM enrichment_job_locks 
WHERE acquired_at < NOW() - INTERVAL '1 hour';
```

## Circuit Breaker Validation

### Test Circuit Breaker (Optional)

1. Temporarily reduce `MAX_CONSECUTIVE_429` to 2 in `batch-enrich-catalog/index.ts`
2. Run batch enrichment on brands likely to hit rate limits
3. Verify run aborts after 2 consecutive 429s
4. Check `enrichment_runs.aborted = true` and `abort_reason` is set
5. Verify remaining brands marked as `status = 'skip'` in `enrichment_run_items`
6. Restore `MAX_CONSECUTIVE_429` to 5

### Expected Behavior

**Without Circuit Breaker**:
- ❌ All 50 brands fail with 429 errors
- ❌ Wastes API quota trying every brand
- ❌ Run takes 10+ minutes to fail completely

**With Circuit Breaker**:
- ✅ First 5 brands fail with 429 errors
- ✅ Circuit breaker triggers
- ✅ Remaining 45 brands skipped
- ✅ Run completes in <2 minutes
- ✅ Returns 429 status code for monitoring alerts

## Common Issues & Fixes

### Issue: Coverage percent stuck at 0%

**Diagnosis**: Brands have QIDs but no company records
```sql
SELECT COUNT(*) FROM brands 
WHERE wikidata_qid IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM brand_data_mappings 
    WHERE brand_id = brands.id AND source = 'wikidata'
  );
```

**Fix**: Run batch enrichment via `/admin/batch-enrich`

### Issue: Lock stuck preventing new runs

**Diagnosis**: 
```sql
SELECT * FROM enrichment_job_locks 
WHERE acquired_at < NOW() - INTERVAL '1 hour';
```

**Fix**: 
```sql
DELETE FROM enrichment_job_locks;
```

### Issue: Duplicate companies for same brand

**Diagnosis**:
```sql
SELECT wikidata_qid, COUNT(*) 
FROM companies 
WHERE wikidata_qid IS NOT NULL 
GROUP BY wikidata_qid 
HAVING COUNT(*) > 1;
```

**Fix**: Unique index prevents new dups. Clean up existing:
```sql
-- Keep most recent, delete older duplicates
DELETE FROM companies 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY wikidata_qid 
      ORDER BY updated_at DESC
    ) AS rn
    FROM companies
    WHERE wikidata_qid IS NOT NULL
  ) sub WHERE rn > 1
);
```

## Performance Benchmarks

### Batch Enrichment (50 brands)

**Expected**:
- Duration: 25-30 minutes (500ms delay + API calls)
- Success rate: >90%
- Memory: <200MB
- 429 errors: <3 per run

**Red Flags**:
- Duration >45 minutes → Network issues or slow Wikidata responses
- Success rate <80% → Invalid QIDs or API changes
- 429 errors >10 → Need to increase delays or reduce batch size

### Daily Cron (20 brands)

**Expected**:
- Duration: 10-12 minutes
- Success rate: >95%
- Runs at: 2:00 AM ± 10 min jitter
- No lock conflicts

**Red Flags**:
- Lock conflicts → Check if manual batch runs overlapping cron schedule
- Duration >20 minutes → Slow Wikidata API or network issues

## Sign-Off Criteria

Before marking enrichment system as "production-ready":

1. ✅ All 10 DB smoke checks pass
2. ✅ UI spot-checks on 3+ diverse brands confirm uniformity
3. ✅ At least 1 successful batch run (50+ brands, >90% success)
4. ✅ At least 1 successful cron run (check next morning)
5. ✅ No stuck locks after 24 hours
6. ✅ Coverage percent >80% (company records / brands with QIDs)
7. ✅ Circuit breaker tested and working
8. ✅ Observability queries return expected ranges

## Monitoring Alerts (Recommended)

Set up alerts for:

- **Lock stuck >1 hour**: Query `enrichment_job_locks` where `acquired_at < NOW() - INTERVAL '1 hour'`
- **Run success rate <80%**: Query `enrichment_runs` where `succeeded::numeric / total < 0.8`
- **Circuit breaker triggered**: Query `enrichment_runs` where `aborted = true`
- **Coverage regression**: Query coverage percent and alert if drops >5% day-over-day

## Post-Launch Maintenance

**Weekly** (5 minutes):
- Run validation queries
- Check for new hot errors
- Verify staleness distribution (most brands should be <14 days)

**Monthly** (15 minutes):
- Review failed enrichment attempts
- Update invalid QIDs or remove dead brands
- Check for Wikidata schema changes (rare but impactful)

**Quarterly** (1 hour):
- Full regression test (UI + DB checks)
- Performance benchmark comparison
- Review circuit breaker thresholds based on actual 429 frequency
