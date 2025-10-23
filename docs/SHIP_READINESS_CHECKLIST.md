# Ship Readiness Checklist

## 1. Constraints & Schema Validation

### Run these queries to verify all constraints are active:

```sql
-- Verify all required constraints exist
SELECT conname, contype, convalidated 
FROM pg_constraint
WHERE conname IN (
  'company_ownership_unique_pair',
  'company_people_unique_role',
  'companies_qid_unique',
  'company_ownership_rel_chk',
  'company_shareholders_pct_chk'
)
ORDER BY conname;
-- Expected: 5 rows, all convalidated = true

-- Verify indexes exist
SELECT schemaname, tablename, indexname 
FROM pg_indexes
WHERE indexname IN (
  'idx_runs_finished_at',
  'idx_runs_task',
  'idx_runs_status',
  'idx_companies_qid'
)
ORDER BY indexname;
-- Expected: 4 rows

-- Verify asset_managers table populated
SELECT count(*) as manager_count FROM asset_managers;
-- Expected: >= 7

-- Verify prevent_asset_manager_parent trigger exists
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'prevent_asset_manager_parent_trigger';
-- Expected: 1 row, tgenabled = 'O' (origin)
```

## 2. Asset-Manager Guardrail Test

```sql
-- Negative test: attempt to insert BlackRock as parent (should FAIL)
DO $$
DECLARE
  blackrock_id uuid;
  test_brand_id uuid;
BEGIN
  -- Find or create a BlackRock company
  INSERT INTO companies (name, wikidata_qid)
  VALUES ('BlackRock, Inc.', 'Q815653')
  ON CONFLICT (wikidata_qid) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO blackrock_id;
  
  -- Get any active brand
  SELECT id INTO test_brand_id FROM brands WHERE is_active LIMIT 1;
  
  -- This should FAIL with "Cannot set asset manager"
  INSERT INTO company_ownership (parent_company_id, child_brand_id, relationship_type)
  VALUES (blackrock_id, test_brand_id, 'parent');
  
  RAISE EXCEPTION 'ERROR: Guardrail failed - asset manager was allowed as parent!';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%Cannot set asset manager%' THEN
      RAISE NOTICE 'SUCCESS: Asset manager guardrail working correctly';
    ELSE
      RAISE;
    END IF;
END $$;
```

## 3. Data Integrity Checks

```sql
-- 1) Invalid relationship types (should be 0)
SELECT count(*) as invalid_relationships
FROM company_ownership
WHERE relationship_type NOT IN ('parent','subsidiary','parent_organization');

-- 2) Accidental asset-manager parents (should be 0)
SELECT co.id, c.name as parent_name, b.name as child_brand
FROM company_ownership co
JOIN companies c ON c.id = co.parent_company_id
JOIN brands b ON b.id = co.child_brand_id
JOIN asset_managers am ON c.name ILIKE '%'||am.name||'%';

-- 3) People uniqueness violations (should be 0)
SELECT company_id, role, count(*) as dupes
FROM company_people
GROUP BY company_id, role
HAVING count(*) > 1;

-- 4) Invalid shareholder percentages (should be 0)
SELECT count(*) as invalid_percentages
FROM company_shareholders
WHERE percent_owned < 0 OR percent_owned > 100;

-- 5) Enum values in use
SELECT DISTINCT relationship_type FROM company_ownership;
SELECT DISTINCT role FROM company_people;
```

## 4. Enrichment Runs Observability (Last 24h)

```sql
SELECT 
  task,
  status,
  count(*) as run_count,
  round(avg(duration_ms)::numeric, 0) as avg_duration_ms,
  sum(rows_written) as total_rows_written
FROM enrichment_runs
WHERE finished_at > now() - interval '24 hours'
GROUP BY task, status
ORDER BY task, status;

-- Success rate (should be >= 80% in dev)
SELECT 
  round(
    (count(*) FILTER (WHERE status = 'success')::numeric / 
     nullif(count(*), 0)) * 100, 
    1
  ) as success_rate_percent
FROM enrichment_runs
WHERE finished_at > now() - interval '24 hours';
```

## 5. Smoke Tests

### A) Brand Wiki (Description + QID only)

```bash
# Set environment variables
export SUPABASE_URL="https://midmvcwtywnexzdwbekp.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Test with a known brand
BRAND_ID="08bfcb05-e7be-4e41-a326-6c31b28c0830"

curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"brand_id\":\"$BRAND_ID\"}" \
  "$SUPABASE_URL/functions/v1/enrich-brand-wiki"
```

**Expected Response:**
```json
{
  "message": "Brand enriched successfully",
  "wikidata_qid": "Q123456",
  "description_updated": true
}
```

**Verify in DB:**
```sql
SELECT 
  name,
  description,
  wikidata_qid,
  wiki_en_title,
  description_source
FROM brands 
WHERE id = '08bfcb05-e7be-4e41-a326-6c31b28c0830';
-- Expected: description_source = 'wikipedia', length(description) >= 40
```

### B) Ownership Enrichment

```bash
BRAND_ID="08bfcb05-e7be-4e41-a326-6c31b28c0830"

curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"brand_id\":\"$BRAND_ID\"}" \
  "$SUPABASE_URL/functions/v1/enrich-ownership"
```

**Expected Response:**
```json
{
  "message": "Ownership enriched successfully",
  "wikidata_qid": "Q123456",
  "rows_written": 1
}
```

**Verify in DB:**
```sql
SELECT 
  co.relationship_type,
  co.confidence,
  co.source_name,
  co.source_ref,
  c.name as parent_name,
  c.wikidata_qid as parent_qid
FROM company_ownership co
JOIN companies c ON c.id = co.parent_company_id
WHERE co.child_brand_id = '08bfcb05-e7be-4e41-a326-6c31b28c0830';
-- Expected: relationship_type = 'parent_organization', provenance fields populated
```

### C) Key People Enrichment

```bash
# First, get the parent company_id from ownership
COMPANY_ID=$(psql $DATABASE_URL -t -c "
  SELECT parent_company_id::text 
  FROM company_ownership 
  WHERE child_brand_id = '08bfcb05-e7be-4e41-a326-6c31b28c0830' 
  LIMIT 1
")

WIKIDATA_QID=$(psql $DATABASE_URL -t -c "
  SELECT wikidata_qid::text 
  FROM companies 
  WHERE id = '$COMPANY_ID'
")

curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"company_id\":\"$COMPANY_ID\",\"wikidata_qid\":\"$WIKIDATA_QID\"}" \
  "$SUPABASE_URL/functions/v1/enrich-key-people"
```

**Expected Response:**
```json
{
  "message": "Key people enriched successfully",
  "count": 3,
  "people": [
    {"name": "John Doe", "role": "chief_executive_officer"},
    {"name": "Jane Smith", "role": "founder"}
  ]
}
```

**Verify in DB:**
```sql
SELECT 
  person_name,
  role,
  wikipedia_url,
  image_file,
  image_url,
  person_qid,
  source_name
FROM company_people
WHERE company_id = '<COMPANY_ID>';
-- Expected: wikipedia_url starts with 'https://en.wikipedia.org/wiki/'
-- Expected: image_url contains 'Special:FilePath' and 'width=256'
-- Expected: person_qid starts with 'Q'
-- Expected: source_name = 'Wikidata'
```

### D) Shareholders (DEV Seed Mode)

```bash
# Enable DEV seed mode
export ENRICH_SHAREHOLDERS_DEV_SEED=1

COMPANY_ID="<PARENT_COMPANY_UUID>"

curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"company_id\":\"$COMPANY_ID\",\"ticker\":\"TEST\"}" \
  "$SUPABASE_URL/functions/v1/enrich-shareholders"
```

**Expected Response:**
```json
{
  "message": "Shareholders enriched successfully",
  "count": 4,
  "note": "API integration placeholder - implement with SEC EDGAR or financial data provider"
}
```

**Verify in DB:**
```sql
SELECT 
  holder_name,
  holder_name_raw,
  holder_type,
  percent_owned,
  is_asset_manager,
  as_of_date,
  source_name
FROM company_shareholders
WHERE company_id = '<COMPANY_ID>'
ORDER BY percent_owned DESC;
-- Expected: 4 rows (Vanguard, BlackRock, State Street, Capital Group)
-- Expected: is_asset_manager = true for first 3, false for Capital Group
-- Expected: source_name = 'DEV_SEED'
```

## 6. Common Footguns Checklist

- [ ] SPARQL query uses `<https://en.wikipedia.org/>` (not blank IRI)
- [ ] All upserts use idempotent merge semantics (coalesce existing values)
- [ ] Parent records live in `companies` table (not `brands`)
- [ ] UI never shows "Independent" when parent exists
- [ ] Batch loops include jitter (150ms ± 150ms)
- [ ] All enrichers log to `enrichment_runs` table
- [ ] Desc-only mode enforced in `enrich-brand-wiki`
- [ ] Asset manager trigger prevents parent relationships

## 7. Admin Monitor Verification

Navigate to `/admin/enrichment-monitor` and verify:

- [ ] Stats cards show: Total Runs, Wiki Enrichments, Ownership Runs, Success Rate
- [ ] List view shows: task, finished_at, duration_ms, status, rows_written
- [ ] Time ago formatting works (e.g., "2 hours ago")
- [ ] Status badges colored correctly (success=green, failed=red, partial=yellow)
- [ ] No console errors

## 8. Suggested Rollout Order

1. **Validate** - Run all queries in section 1-4 above
2. **Wiki Batch** - Enrich descriptions for 50 brands missing them
3. **Ownership Top 30** - Run ownership enrichment for top 30 brands
4. **UI Spot Check** - Verify parent relationships show correctly
5. **Key People** - Enrich key people for parent companies
6. **Shareholders DEV** - Test with 3 public companies using DEV_SEED
7. **Real Data** - Integrate SEC EDGAR or financial data provider
8. **Full Rollout** - Batch process all active brands

## 9. Test Brand Examples

### Public Parent (Walmart)
- Brand: Great Value
- Expected Parent: Walmart Inc. (Q483551)
- Expected People: Doug McMillon (CEO), Sam Walton (Founder)

### Private Brand (Dove)
- Brand: Dove
- Expected Parent: Unilever (Q157062)
- Expected People: Hein Schumacher (CEO)

### Tricky Case (Complex Ownership)
- Brand: Instagram
- Expected Parent: Meta Platforms (Q380)
- Expected People: Mark Zuckerberg (Founder, CEO)
