# Real-Only Validation Scripts

These scripts enforce the "real + cited only" policy: scores and summaries only appear when brands have verified events with evidence.

## Smoke Tests (`smoke.sh`)

Run before deploying to catch baseline leaks:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export TEST_BRAND_ID="4965edf9-68f3-4465-88d1-168bc6cc189a"  # Unilever
bash scripts/smoke.sh
```

**What it checks:**
- `/trending` returns only brands with recent verified events
- `/search` works and returns structured data
- `/brands/:id` enforces real-only gating:
  - Verified brands (hasEvent=true, hasEvidence=true) → show score/summary
  - Unverified brands → score/summary are null
- Evidence URLs are valid HTTP(S) links

**Exit codes:**
- `0` = All checks passed ✅
- `1` = Leak detected or endpoint failure ❌

## Database Sentinel (`db-sentinel.sql`)

Run in your CI pipeline via `psql`:

```bash
psql "$DATABASE_URL" -f scripts/db-sentinel.sql > sentinel-report.txt
# Check output: all counts should be 0
```

**What it checks:**
- `trending_leaks`: brands in trending without events
- `summary_leaks`: AI summaries without evidence URLs
- `standings_mismatches`: scores present without verified events

**Expected output:**
```
 trending_leaks | leaked_brands 
----------------+---------------
              0 | {}

 summary_leaks | leaked_summaries 
---------------+------------------
             0 | {}

 standings_mismatches | mismatched_brands 
----------------------+-------------------
                    0 | {}
```

Any count > 0 indicates a baseline leak.

## Development Guards

The app includes dev-time protections:

1. **Fetch interceptor** (`src/main.tsx`):
   - Blocks direct queries to `brand_scores`, `brand_baseline`, etc.
   - Forces all data through Edge API
   - Only active in `DEV` mode

2. **UI leak detector** (`BrandDetail.tsx`):
   - Shows red error screen if score/summary present without evidence
   - Logs leak details to console
   - Only active in `DEV` mode

## CI Integration

Add to your `.github/workflows/ci.yml`:

```yaml
- name: Run smoke tests
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    TEST_BRAND_ID: "4965edf9-68f3-4465-88d1-168bc6cc189a"
  run: bash scripts/smoke.sh

- name: Database sentinel
  run: |
    psql "$DATABASE_URL" -f scripts/db-sentinel.sql > sentinel.txt
    if grep -E '[1-9][0-9]*' sentinel.txt; then
      echo "❌ Baseline leak detected"
      cat sentinel.txt
      exit 1
    fi
```

## After Data Ingestion

Refresh coverage stats after adding new events:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY brand_data_coverage;
```

Or schedule hourly via cron:

```sql
SELECT cron.schedule(
  'refresh-coverage',
  '0 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY brand_data_coverage$$
);
```
