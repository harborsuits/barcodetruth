# Production Launch Checklist

## Pre-Launch Validation (10 minutes)

### 1. Search Rate Limiting

**Test rate limit:**
```bash
for i in {1..12}; do \
  curl -s -X POST "$SUPABASE_URL/functions/v1/search-brands" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"q":"a"}' | jq -r '.error // "ok"'; done
```

**Expected:** ~8 "ok" responses, then "rate_limited" errors

**Verify logs:**
- Filter: `fn="search-brands"`
- Check for: `dur_ms`, `count`, `level:"warn"` entries for rate-limited requests

### 2. Proof Endpoint Logging

**Test with live brands:**
```bash
curl "$SUPABASE_URL/functions/v1/get-brand-proof?brandId=<BRAND_ID>" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

**Verify structured logs contain:**
- `cats[].ver` (verified count)
- `cats[].owners` (independent owners)
- `cats[].hid` (syndicated hidden count)
- `dur_ms` (latency)
- `ok: true`

**Create monitoring:**
- Chart: `p95(dur_ms)` for `fn="get-brand-proof"`
- Alert: P95 > 800ms for 5 minutes

### 3. Scorer Logging

**Trigger a score calculation:**
```bash
curl "$SUPABASE_URL/functions/v1/calculate-brand-score?brand_id=<BRAND_ID>" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

**Verify log includes:**
- `baselines` (all 4 categories)
- `deltas` (window changes)
- `mutedDeltas` (proof-required flags)
- `verifiedCount`, `evidenceCount`
- `dur_ms`

### 4. Database Indexes

**Verify indexes exist:**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('brand_events', 'event_sources')
ORDER BY tablename, indexname;
```

**Must include:**
- `idx_brand_events_brand_category`
- `idx_brand_events_brand_date`
- `idx_event_sources_event`

### 5. Feature Flags

**Verify flags table:**
```sql
SELECT key, value FROM app_config WHERE key IN ('gdelt_enabled', 'dedup_enabled', 'wayback_enabled');
```

**Expected:** All three flags present with `{"on": true}`

## Health Monitoring

### Health Endpoint

**Check system health:**
```bash
curl "$SUPABASE_URL/functions/v1/health" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

**Expected response:**
```json
{
  "ok": true,
  "checks": { "db": "pass" },
  "latency_ms": <number>
}
```

**Wire to uptime monitor:** Ping every 60 seconds, alert if `ok: false` or latency > 2000ms

## Alerts to Configure

### Performance Alerts

1. **Proof endpoint latency:**
   - Metric: `p95(dur_ms)` where `fn="get-brand-proof"`
   - Threshold: > 800ms for 5 minutes
   - Action: Check database load, indexes

2. **Scorer latency:**
   - Metric: `p95(dur_ms)` where `fn="calculate-brand-score"`
   - Threshold: > 2000ms for 5 minutes
   - Action: Check GDELT API, database load

### Error Rate Alerts

1. **Function errors:**
   - Metric: `count(*)` where `level="error"` by `fn`
   - Threshold: > 10 errors per 5 minutes per function
   - Action: Check function logs, rollback if needed

2. **Rate limit abuse:**
   - Metric: `count(*)` where `fn="search-brands" AND level="warn"`
   - Threshold: > 100 per minute
   - Action: Possible abuse, consider adjusting rate limits

## Manual Smoke Test

**Run before each deploy:**

1. **Search flow:**
   - Type in search box → see results
   - Click result → brand detail loads
   - Score Breakdown visible with Base/Δ/Now columns
   - Confidence bars render correctly

2. **Evidence flow:**
   - Click "View all evidence"
   - Proof page loads with categorized evidence
   - Toggle "Show syndicated copies" (if badge present)
   - Verify count increases when showing syndicated

3. **Timeline flow:**
   - Recent Events section shows events
   - Date, category chip, ±delta, verification badge all render
   - Empty state shows helpful message if no events

**Or run automated test:**
```bash
APP_URL=https://yourapp.com npx playwright test tests/smoke.spec.ts
```

## Emergency Procedures

### Kill Switches (Instant, no deploy)

**Disable GDELT baseline:**
```sql
UPDATE app_config SET value='{"on": false}' WHERE key='gdelt_enabled';
```
*Effect:* Social scores fall back to 50 baseline

**Disable evidence deduplication:**
```sql
UPDATE app_config SET value='{"on": false}' WHERE key='dedup_enabled';
```
*Effect:* Shows all evidence, including syndicated copies

**Disable Wayback archiving:**
```sql
UPDATE app_config SET value='{"on": false}' WHERE key='wayback_enabled';
```
*Effect:* Skips Wayback calls in backfill jobs

### Rate Limit Adjustments

**If search is too restrictive:**

Edit `supabase/functions/search-brands/index.ts`:
```typescript
const CAP = 16;              // increase burst capacity
const REFILL_PER_SEC = 40/60; // increase to ~40/min
```

### Rollback Procedure

1. **Frontend rollback:**
   - Redeploy previous Git tag: `git checkout v1.0-pre-launch`
   - Or use hosting provider's rollback feature

2. **Database rollback:**
   - Migrations are additive and idempotent
   - No destructive changes in this release
   - Feature flags can disable new functionality

3. **Function rollback:**
   - Functions auto-deploy with code
   - Rollback frontend to get previous function versions
   - Or manually revert specific function files

## Success Metrics

**Monitor first 24 hours:**

- Search requests: Should see steady traffic, <5% rate-limited
- Proof endpoint P95: Should stay <500ms
- Scorer latency: Should stay <1500ms
- Error rate: Should stay <1% across all functions
- GDELT API: Check for 429 errors (adjust delays if needed)

**User Experience:**
- Brand detail pages load in <2s
- Search results appear in <500ms
- Evidence toggles work smoothly
- No "white screen" errors

## Post-Launch Review

**After 48 hours, check:**

1. Which brands have the most proof page views?
2. Are confidence scores clustering around expected ranges?
3. Any categories systematically showing low confidence?
4. GDELT baseline working for established brands?
5. Dedup toggle usage (do users click it)?

**Weekly:**
- Review error logs for patterns
- Check if any functions need optimization
- Verify backup and recovery procedures
- Update this checklist with lessons learned
