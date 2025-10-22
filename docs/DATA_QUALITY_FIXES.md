# Data Quality Fixes - Critical Enrichment Issues

## Problem Identified

**CRITICAL**: Multiple brands were showing completely incorrect descriptions from Wikidata due to entity mismatch:
- **Ferrero** → Showing "FIFA U-20 Women's World Cup" (sports tournament)
- **Adidas** → Similar entity confusion
- Many brands missing parent companies and key people entirely

## Root Cause

1. **No Entity Type Validation**: The enrichment function trusted Wikidata IDs without validating they represent companies/brands
2. **No P31 (instance of) Checking**: Didn't verify the entity type before pulling description
3. **Sports Events Being Matched**: Searches were returning sports tournaments, competitions instead of companies

## Fixes Implemented

### 1. Entity Type Validation (P31 - Instance Of)

Added validation using Wikidata's P31 property to check entity type:

**BAD ENTITY TYPES (now rejected):**
- `Q18608583` - sports competition
- `Q500834` - association football competition
- `Q27020041` - sports season
- `Q15061018` - FIFA Women's World Cup
- `Q19317` - tournament
- `Q2990593` - sports event
- `Q1656682` - sports championship
- `Q1194951` - association football tournament

**GOOD ENTITY TYPES (validated):**
- `Q783794` - company
- `Q891723` - public company
- `Q167037` - corporation
- `Q658255` - conglomerate
- `Q431289` - brand
- `Q43229` - organization

### 2. Search Filtering Enhancement

Enhanced search to:
- Filter out descriptions containing: "tournament", "championship", "world cup", "competition"
- Prefer descriptions containing: "company", "brand", "corporation", "manufacturer"
- Re-search if existing Wikidata ID fails validation

### 3. Data Cleanup

Executed migration to clear bad data:
```sql
UPDATE brands
SET 
  wikidata_qid = NULL,
  description = NULL,
  description_source = NULL
WHERE description LIKE '%World Cup%'
  OR description LIKE '%tournament%'
  OR description LIKE '%championship%'
  OR description LIKE '%FIFA%'
  OR description LIKE '%Olympic%';
```

## Testing & Verification

### Before Fix
- Ferrero: "FIFA U-20 Women's World Cup" ❌
- No parent companies ❌
- No key people ❌

### After Fix
- Entity validation active ✅
- Re-search if entity type is wrong ✅
- Only company/brand entities accepted ✅

## Next Steps

### 1. Run Batch Enrichment
Navigate to `/admin/enrichment` and click "Run Batch Enrichment"

This will:
- Re-enrich all brands with NULL descriptions
- Validate entity types using P31
- Find correct companies/brands
- Extract parent companies (P749)
- Extract key people: CEO (P169), Chairperson (P488), Founders (P112)

### 2. Manual Verification

Check these brands after enrichment:
```sql
-- Check Ferrero
SELECT 
  b.name,
  b.description,
  c.name as parent_company,
  (SELECT COUNT(*) FROM company_people cp WHERE cp.company_id = c.id) as key_people_count
FROM brands b
LEFT JOIN company_ownership co ON co.child_brand_id = b.id
LEFT JOIN companies c ON c.id = co.parent_company_id
WHERE b.name = 'Ferrero';
```

Expected for Ferrero:
- Description: About Ferrero chocolate/confectionery company
- Parent: Ferrero Group or similar
- Key People: CEO, founders (Giovanni Ferrero, etc.)

### 3. Monitor Enrichment Runs

Watch enrichment runs at `/admin/enrichment`:
- Check success rate
- Verify parent companies found
- Verify people added
- Check for error patterns

### 4. Quality Assurance Queries

```sql
-- Find brands still with bad descriptions
SELECT name, LEFT(description, 100) as desc_preview
FROM brands
WHERE description LIKE '%tournament%'
   OR description LIKE '%World Cup%'
   OR description LIKE '%championship%'
   OR description LIKE '%competition%'
LIMIT 10;

-- Check enrichment success rate
SELECT 
  COUNT(*) as total_runs,
  SUM(CASE WHEN parent_found THEN 1 ELSE 0 END) as parents_found,
  SUM(people_added) as total_people,
  SUM(CASE WHEN ticker_added THEN 1 ELSE 0 END) as tickers_added,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as errors
FROM enrichment_runs
WHERE run_at > NOW() - INTERVAL '1 hour';
```

## Ongoing Quality Controls

### 1. Description Validation
- Length check: Reject < 50 chars (likely wrong entity)
- Content check: Flag sports/event keywords
- Source verification: Prefer Wikipedia over Wikidata descriptions

### 2. Parent Company Validation
- Must have wikidata_qid
- Must have description
- Must be P749 relationship in Wikidata

### 3. Key People Validation
- CEO: P169 property
- Chairperson: P488 property
- Founder: P112 property
- Must have person_qid
- Confidence scoring based on data completeness

## Edge Cases to Watch

### 1. Brand = Company
Some brands are their own parent company:
- Nike (brand = Nike, Inc.)
- Apple (brand = Apple Inc.)

**Solution**: Still create company record, link via ownership

### 2. Multiple Parents
Some brands have changed ownership:
- Instagram (Facebook → Meta)

**Solution**: Keep most recent, log others

### 3. Holding Companies
Complex ownership chains:
- Tide → P&G Consumer Health → Procter & Gamble

**Solution**: Direct parent only for now, add chain later

### 4. Private vs Public Companies
Need different data:
- Public: ticker, exchange, filings
- Private: estimated value, ownership structure

**Solution**: Flag is_public, populate ticker only if public

## Documentation Links

- [Wikidata P31 Property](https://www.wikidata.org/wiki/Property:P31)
- [Wikidata Company Entities](https://www.wikidata.org/wiki/Q783794)
- [Enrichment Monitor](./ENRICHMENT_AUDIT_COMPLETE.md)
- [Ownership Enrichment Guide](./OWNERSHIP_ENRICHMENT_GUIDE.md)

## Deployment Checklist

- [x] Add P31 validation to enrichment function
- [x] Add bad entity type filtering
- [x] Clear bad data from database
- [x] Deploy updated enrichment function
- [ ] Run batch enrichment for all brands
- [ ] Verify Ferrero and other problem cases
- [ ] Monitor enrichment runs for 24h
- [ ] Document any new edge cases
