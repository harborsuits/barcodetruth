# Batch Brand Enrichment System

## Problem Statement

**Critical Issue**: Out of 76 active brands, 73 have Wikidata QIDs but **ZERO have company records**, meaning:
- No ownership data (parent companies)
- No key people (CEOs, founders)
- No shareholder information
- Inconsistent brand profile quality

This makes every brand profile look incomplete compared to Walmart, which was manually enriched.

## Solution Architecture

### 1. Batch Processing Edge Function
**File**: `supabase/functions/batch-enrich-catalog/index.ts`

Processes multiple brands at once:
- Fetches all brands with Wikidata QIDs
- Calls `enrich-brand-wiki` in **full mode** for each
- Rate-limited to avoid Wikidata throttling (500ms delay between requests)
- Supports dry-run mode to preview changes

**Usage**:
```bash
# Dry run to preview
curl -X POST \
  'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-enrich-catalog' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"limit": 50, "dry_run": true}'

# Actual enrichment
curl -X POST \
  'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-enrich-catalog' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"limit": 50, "dry_run": false}'
```

### 2. Automated Daily Enrichment
**File**: `supabase/functions/enrich-all-brands-cron/index.ts`

- Runs daily at 2 AM via pg_cron
- Uses fair rotation algorithm (from `get_next_brands_fair_rotation`)
- Processes 20 brands per run
- Prioritizes brands with stale data

**Cron Job**:
```sql
SELECT cron.schedule(
  'enrich-brands-daily',
  '0 2 * * *', -- 2 AM daily
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/enrich-all-brands-cron',
    ...
  );
  $$
);
```

### 3. Admin UI for Monitoring & Control
**File**: `src/pages/AdminBatchEnrich.tsx`
**Route**: `/admin/batch-enrich`

Features:
- **Coverage Dashboard**: Shows enrichment completeness across catalog
- **Batch Processing**: Trigger manual enrichment with configurable batch sizes
- **Progress Monitoring**: Real-time stats on success/failure rates
- **Brand Queue**: Lists next brands needing enrichment

**Key Metrics Tracked**:
- Total brands with Wikidata QIDs
- Brands with company records (currently 0%)
- Brands with ownership data
- Brands with key people
- Brands with shareholders

### 4. Coverage Tracking Function
**Database Function**: `get_enrichment_coverage()`

Returns comprehensive stats:
```json
{
  "total_brands": 76,
  "has_wikidata_qid": 73,
  "has_company_record": 0,
  "coverage_percent": 0,
  "brands_needing_enrichment": [...]
}
```

## Data Flow

```
┌─────────────────┐
│  Wikidata API   │
└────────┬────────┘
         │
         v
┌─────────────────────────┐
│ enrich-brand-wiki       │
│ (mode: 'full')          │
└────────┬────────────────┘
         │
         ├─> companies table
         ├─> company_ownership table
         ├─> company_people table
         └─> company_shareholders table
```

## Enrichment Data Extracted

For each brand with a Wikidata QID, the system fetches:

### 1. Parent Company
- Company name, ticker, exchange
- Wikipedia description
- Public/private status
- Country of incorporation
- Logo URL

### 2. Key People (up to 6)
- CEO, Chairperson, Founder roles
- Full name, role title
- Profile image from Wikidata
- Wikipedia URL
- Wikidata QID

### 3. Shareholders (if public)
- Top institutional holders
- Ownership percentages
- Holder type (institutional/individual)
- Asset manager identification

## Usage Instructions

### Immediate Fix (One-Time Batch)

1. **Navigate to Admin UI**:
   ```
   /admin/batch-enrich
   ```

2. **Run Dry Run** to preview:
   - Select batch size (50 recommended)
   - Click "Dry Run"
   - Review brands to be processed

3. **Execute Batch Enrichment**:
   - Click "Start Enrichment"
   - Monitor progress in real-time
   - Review success/failure stats

4. **Verify Results**:
   - Check coverage percent increasing
   - Visit brand profiles (e.g., Chobani)
   - Confirm ownership, key people, shareholders appear

### Ongoing Maintenance

**Automated Daily Enrichment** now runs at 2 AM:
- Processes 20 brands per day using fair rotation
- Prioritizes brands with stale data
- Uses Fortune 500 tiering for API quota management

**Manual Triggers**:
- Use admin UI for immediate enrichment needs
- Supports configurable batch sizes (10-100 brands)

## Expected Outcomes

After full catalog enrichment, ALL brand profiles will have:

✅ **Consistent Features**:
- Ownership tab with parent company details
- Key People section with executive profiles
- Top Shareholders card (for public companies)
- Company description from Wikipedia
- Uniform empty states when data unavailable

✅ **Walmart-Level Quality**:
- Every profile shows same level of detail
- No more "No Ownership Data" placeholders
- Proper fallback handling (parent → direct data)
- Freshness indicators on all data

## Monitoring & Troubleshooting

### Check Enrichment Status
```sql
SELECT * FROM get_enrichment_coverage();
```

### View Recent Enrichment Runs
```sql
SELECT * FROM enrichment_runs 
WHERE run_at > NOW() - INTERVAL '24 hours'
ORDER BY run_at DESC;
```

### Check Specific Brand
```sql
-- Check if brand has company record
SELECT b.name, b.wikidata_qid, c.id as company_id
FROM brands b
LEFT JOIN brand_data_mappings bdm ON b.id = bdm.brand_id AND bdm.source = 'wikidata'
LEFT JOIN companies c ON bdm.external_id = c.wikidata_qid
WHERE b.id = 'BRAND_ID_HERE';

-- Check ownership
SELECT * FROM company_ownership WHERE child_brand_id = 'BRAND_ID_HERE';

-- Check key people
SELECT * FROM company_people WHERE company_id IN (
  SELECT parent_company_id FROM company_ownership WHERE child_brand_id = 'BRAND_ID_HERE'
);
```

### Common Issues

**Issue**: Enrichment succeeds but no data appears
- **Cause**: `enrich-brand-wiki` running in `desc-only` mode
- **Fix**: Ensure edge function uses `mode: 'full'` parameter

**Issue**: Rate limiting errors from Wikidata
- **Cause**: Too many requests in short time
- **Fix**: Reduce batch size or increase delay between requests (currently 500ms)

**Issue**: Company record created but no ownership link
- **Cause**: Missing `brand_data_mappings` entry
- **Fix**: Verify mapping created: `SELECT * FROM brand_data_mappings WHERE brand_id = '...'`

## Performance Considerations

- **Wikidata Rate Limits**: 500ms delay between requests = ~2 brands/second
- **Full Catalog (73 brands)**: ~40 minutes for complete enrichment
- **Daily Maintenance**: 20 brands/day = full refresh every 3-4 days

## Next Steps

1. **Immediate**: Run batch enrichment on entire catalog
2. **Verify**: Check 10-20 random brand profiles for completeness
3. **Monitor**: Track coverage metrics over 7 days
4. **Optimize**: Adjust daily batch size based on Wikidata API stability

## Related Documentation

- `docs/OWNERSHIP_ENRICHMENT_GUIDE.md` - Details on enrichment data structure
- `docs/BRAND_PROFILE_UNIFORMITY.md` - UI rendering standards
- `docs/BRAND_PROFILE_STANDARD.md` - Walmart reference implementation
