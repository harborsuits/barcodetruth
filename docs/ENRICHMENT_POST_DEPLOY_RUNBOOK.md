# Enrichment Pipeline Post-Deploy Runbook

## Pre-Flight Checklist (5 minutes)

### 1. Database Validation
Run the validation SQL to ensure zero issues:

```bash
psql "$DATABASE_URL" -f docs/ENRICHMENT_VALIDATION.sql
```

**Expected:** All "invalid/dupes" queries return zero rows.

### 2. Constraint & Trigger Verification
```sql
-- Check constraints are active
SELECT conname, contype, convalidated 
FROM pg_constraint 
WHERE conname IN (
  'company_ownership_unique_pair',
  'company_people_unique_role',
  'companies_qid_unique',
  'company_shareholders_pct_chk'
);

-- Check trigger is enabled
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'prevent_asset_manager_parent_trigger';
```

**Expected:** All constraints show `convalidated = true`, trigger shows `tgenabled = 'O'`.

### 3. Smoke Test (Single Brand)
```bash
export SUPABASE_SERVICE_ROLE_KEY='your-service-key'
export ENRICH_SHAREHOLDERS_DEV_SEED=1

./scripts/smoke_test_enrichment.sh <BRAND_UUID>
```

**Expected:** 
- Wiki enrichment returns `wikidata_qid` or `rows_written: 0`
- Ownership enrichment writes at least 1 parent edge
- Key people enrichment writes CEO/Founder/Chairperson
- Shareholders enrichment returns 4 DEV seed rows

## Deployment Steps

### Step 1: Batch Descriptions (50 brands)
```bash
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/functions/v1/bulk-enrich-brands"
```

**Monitor:** `/admin/enrichment-monitor` → Filter "Wiki" → Success rate ≥ 80%

### Step 2: Ownership (Top 30 Active Brands)
Get top 30 brand IDs:
```sql
SELECT id, name FROM brands 
WHERE is_active = true 
ORDER BY last_news_ingestion DESC NULLS LAST 
LIMIT 30;
```

Run ownership enrichment for each:
```bash
for BRAND_ID in $(cat top30_ids.txt); do
  curl -X POST \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"brand_id\":\"$BRAND_ID\"}" \
    "$SUPABASE_URL/functions/v1/enrich-ownership"
  sleep 0.3 # Rate limit
done
```

**Monitor:** Filter "Ownership" → Check `rows_written > 0` for brands with parents

### Step 3: Key People (Parent Companies)
Get parent company IDs from Step 2:
```sql
SELECT DISTINCT parent_company_id, c.wikidata_qid
FROM company_ownership co
JOIN companies c ON c.id = co.parent_company_id
WHERE co.relationship_type = 'parent_organization'
AND c.wikidata_qid IS NOT NULL;
```

Run key people enrichment:
```bash
for row in $(jq -r '.[] | @base64' parents.json); do
  _jq() { echo $row | base64 --decode | jq -r ${1}; }
  COMPANY_ID=$(_jq '.parent_company_id')
  QID=$(_jq '.wikidata_qid')
  
  curl -X POST \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"company_id\":\"$COMPANY_ID\",\"wikidata_qid\":\"$QID\"}" \
    "$SUPABASE_URL/functions/v1/enrich-key-people"
  sleep 0.3
done
```

**Monitor:** Filter "Key People" → Verify `rows_written = 3` (CEO + Founder + Chair)

### Step 4: Shareholders (DEV Seed First)
```bash
export ENRICH_SHAREHOLDERS_DEV_SEED=1

for COMPANY_ID in $(cat parent_company_ids.txt); do
  curl -X POST \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"company_id\":\"$COMPANY_ID\",\"ticker\":\"TEST\"}" \
    "$SUPABASE_URL/functions/v1/enrich-shareholders"
  sleep 0.3
done
```

**Monitor:** Filter "Shareholders" → Verify source = "DEV (seeded)"

## Post-Deploy Verification

### 1. Admin Monitor Health
Navigate to `/admin/enrichment-monitor`:

- **Success (24h)** pill shows ≥80% (green)
- Filter by each task type and verify runs
- Check "Rows Written" column has non-zero values

### 2. Spot-Check 3 Real Profiles

#### Public Company (e.g., Walmart)
```sql
SELECT * FROM brands WHERE name ILIKE '%walmart%';
-- Copy brand_id, visit /brand/{id}
```

**Expected:**
- Parent company shows (e.g., "Walmart Inc.")
- Key people card shows CEO, Founder, Chairperson with photos
- Shareholders card shows with "DEV data" disclaimer

#### Private Subsidiary (e.g., Dove)
```sql
SELECT * FROM brands WHERE name ILIKE '%dove%';
```

**Expected:**
- Parent company shows (e.g., "Unilever")
- Key people inherited from parent
- Shareholders shows parent's data

#### Complex History (Multi-Parent/Merger)
Pick a brand with acquisition history.

**Expected:**
- Shows most confident parent relationship
- UI never says "Independent" if parent exists

### 3. Data Quality Spot-Checks
```sql
-- Wikipedia URLs should be enwiki
SELECT person_name, wikipedia_url 
FROM company_people 
WHERE wikipedia_url IS NOT NULL 
AND wikipedia_url NOT LIKE 'https://en.wikipedia.org/wiki/%'
LIMIT 5;

-- Image URLs should use Special:FilePath
SELECT person_name, image_url 
FROM company_people 
WHERE image_url IS NOT NULL 
AND image_url NOT LIKE '%Special:FilePath%'
LIMIT 5;

-- Shareholders should have pct between 0-100
SELECT holder_name, pct 
FROM company_shareholders 
WHERE pct < 0 OR pct > 100;
```

**Expected:** All queries return zero rows.

## Rollback Procedure

If success rate < 60% or critical issues found:

1. **Stop batch jobs** (kill any running cron/loops)
2. **Check error logs:**
   ```sql
   SELECT task, error_message, count(*) 
   FROM enrichment_runs 
   WHERE finished_at > now() - interval '1 hour'
   AND status = 'failed'
   GROUP BY 1, 2;
   ```
3. **Restore previous function versions** (keep backups for 7 days)
4. **Set feature flag:**
   ```bash
   # In edge function env vars
   ENRICH_MODE=legacy
   ```

## Next Steps

After 24h of stable operation:

1. **Wire real shareholders data source** (replace DEV_SEED with actual API)
2. **Enable batch cron jobs** for daily updates
3. **Monitor long-term:** Success rate stays ≥85%, avg duration < 2s per task

## Troubleshooting

### Issue: "Asset manager set as parent" error
**Cause:** Trigger working correctly (this is expected for BlackRock/Vanguard).
**Fix:** Use `company_shareholders` table instead of `company_ownership`.

### Issue: SPARQL returns no people
**Check:** `wikidata_qid` is valid and entity has P169/P112/P488 claims.
**Fix:** Verify QID at wikidata.org/wiki/<QID>

### Issue: Images not loading
**Check:** `image_url` format is `https://commons.wikimedia.org/wiki/Special:FilePath/<filename>?width=256`
**Fix:** Re-run `enrich-key-people` for affected companies.

### Issue: Success rate < 80%
**Investigate:**
```sql
SELECT task, error_message, count(*) 
FROM enrichment_runs 
WHERE finished_at > now() - interval '24 hours'
GROUP BY 1, 2 
ORDER BY 3 DESC;
```

Common errors:
- Rate limit hit (429) → Increase jitter in batch loop
- Invalid QID → Skip or manual correction
- Network timeout → Retry with backoff

## Contact

For issues not covered here, check:
- `docs/ENRICHMENT_VALIDATION.sql` for health queries
- `scripts/smoke_test_enrichment.sh` for test examples
- Admin monitor at `/admin/enrichment-monitor` for live status
