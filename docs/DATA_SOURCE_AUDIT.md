# Data Source Audit: How Features Get Populated

## Executive Summary

**What's Working:**
- ✅ Logo resolution (21% coverage, clean fallback chain)
- ✅ Descriptions (91% coverage, robust Wikipedia integration)
- ✅ Scores (100% coverage, defaults working)

**What's Broken:**
- ❌ Key People enrichment has 3 redundant functions (1.3% coverage)
- ❌ Parent company has 3 overlapping functions (0% coverage in new schema)
- ❌ Shareholder data source unclear
- ❌ No automated batch processing

---

## Feature-by-Feature Analysis

### 1. Descriptions (91% coverage, 70/77 brands)

**Function:** `enrich-brand-wiki`  
**Source:** Wikipedia + Wikidata  
**Trigger:** Auto-triggered when brand profile loads and description is missing

**Process:**
1. Search Wikidata for brand name (tries multiple query patterns)
2. Validate entity type (P31 - instance of) to avoid sports events
3. Filter out disambiguation pages, people, places
4. Get Wikipedia page title from Wikidata sitelinks
5. Fetch Wikipedia extract using MediaWiki API
6. Update brand or parent company with description

**Strengths:**
- Aggressive filtering prevents wrong matches
- Tries parent company if brand has one
- Handles disambiguation well
- Batch mode available (`?mode=missing`)

**Issues:**
- Complex search logic with 6+ fallback queries
- Can still match wrong entities (e.g., "FIFA Women's World Cup" instead of company)
- No confidence scoring
- Missing 7 brands still

**Recommendation:** ✅ Keep but simplify search logic, add confidence scores

---

### 2. Parent Company (0% coverage in new schema)

**Functions:** THREE overlapping functions! 🚨
- `enrich-brand-wiki` (lines 426-570)
- `enrich-ownership` (full file, 227 lines)
- `enrich-company-profile` (full file, 295 lines)

**Source:** Wikidata P749 (parent org), P127 (owned by), P176 (manufactured by)

**Process:**
- All three functions query Wikidata for parent relationships
- All three create `company_ownership` records
- All three fetch company details

**Strengths:**
- SPARQL queries are solid
- Gets country, ticker, public/private status
- Creates company entries automatically

**Issues:**
- **CRITICAL: Three functions doing the same job** (maintenance nightmare)
- `enrich-brand-wiki` writes to old schema
- `enrich-ownership` creates brands, not companies
- `enrich-company-profile` is the only one using correct schema
- No coordination between functions
- 0% coverage because new `company_ownership` table not populated

**Recommendation:** 🔥 **Consolidate into ONE function, migrate old data**

---

### 3. Key People (1.3% coverage, 1/77 brands)

**Functions:** THREE overlapping functions! 🚨
- `enrich-brand-wiki` (lines 571-650)
- `enrich-key-people` (new, 137 lines)
- `enrich-company-profile` (lines 193-236)

**Source:** Wikidata P169 (CEO), P488 (Chair), P112 (Founder), P18 (image)

**Process:**
- SPARQL query for executives/founders
- Fetch profile images from Wikimedia Commons
- Insert into `company_people` table

**Strengths:**
- Image URL conversion works (Commons → FilePath)
- Role canonicalization (snake_case)
- Photo fallback to gray circle

**Issues:**
- **CRITICAL: Three functions doing the same job**
- `enrich-brand-wiki` includes people in main flow
- `enrich-key-people` is standalone (not called anywhere)
- `enrich-company-profile` duplicates logic
- Only 1 brand (Ferrero) has people data
- No batch runner

**Recommendation:** 🔥 **Delete redundant functions, run batch enrichment**

---

### 4. Logos (21% coverage, 16/77 brands)

**Function:** `resolve-brand-logo`  
**Source:** Wikimedia Commons (P154) → Clearbit fallback  
**Trigger:** Manual or batch job

**Process:**
1. Check if manual override (skip if yes)
2. Fetch Wikidata entity, get P154 (logo image)
3. Build Commons FilePath URL
4. Verify it's an image (HEAD request)
5. Fallback to Clearbit if Commons fails
6. Update brand with logo_url + attribution

**Strengths:**
- Clean timeout handling (5-8s)
- Respects manual overrides
- Dual-source fallback
- Proper content-type validation

**Issues:**
- 61 brands still missing logos
- No batch mode
- Doesn't check P18 (general image) as fallback
- Doesn't try brand website favicon

**Recommendation:** ✅ Keep but add batch mode, more fallbacks

---

### 5. Shareholders (Unknown coverage)

**Functions:** NONE FOUND 🚨  
**Source:** Unknown  
**Database:** `company_shareholders` table exists but empty?

**Strengths:**
- Schema looks good (holder_name, pct, holder_type, is_asset_manager)

**Issues:**
- No enrichment function found
- No data source configured
- Unclear if manual data or API
- 3 public companies have <4 shareholders

**Recommendation:** 🔥 **Create shareholder enrichment function (Wikidata P1830 or financial APIs)**

---

### 6. Scores (100% coverage)

**Function:** DB-level defaults  
**Source:** `brand_scores` table with default 50  
**Trigger:** `ensure_default_scores()` function

**Process:**
- Four scores per brand (labor, environment, integrity, community)
- Defaults to 50 if no events
- Updated by scoring functions

**Strengths:**
- 100% coverage via defaults
- Clean UX (never shows "N/A")

**Issues:**
- No connection to enrichment pipeline shown

**Recommendation:** ✅ Working as intended

---

## Critical Problems

### Problem 1: Function Sprawl (HIGHEST PRIORITY)

**Redundant Functions:**
```
Parent Company:
  - enrich-brand-wiki      ⎤
  - enrich-ownership       ⎥ ALL DO THE SAME THING
  - enrich-company-profile ⎦

Key People:
  - enrich-brand-wiki      ⎤
  - enrich-key-people      ⎥ ALL DO THE SAME THING
  - enrich-company-profile ⎦
```

**Impact:**
- Maintenance nightmare (change needs to happen 3 times)
- Functions conflict (different schemas)
- Impossible to know which to call
- 0% coverage in new schema

**Fix:**
```
DELETE:
  - enrich-ownership
  - enrich-key-people
  
KEEP:
  - enrich-brand-wiki (parent + description)
  - enrich-company-profile (people + valuation)
  
MIGRATE:
  - Run one-time script to move old data to new schema
```

---

### Problem 2: No Batch Processing

**Current State:**
- Logo: No batch mode
- Key People: No batch runner
- Parent Company: enrich-brand-wiki has `?mode=missing` but uses old schema

**Impact:**
- 76 brands need manual enrichment one-by-one
- Slow rollout of new features

**Fix:**
```sql
-- Create batch enrichment function
CREATE OR REPLACE FUNCTION batch_enrich_brands()
RETURNS TABLE(brand_id uuid, status text) AS $$
BEGIN
  RETURN QUERY
  SELECT id, 'queued'
  FROM brands
  WHERE is_active = true
    AND (
      description IS NULL OR
      NOT EXISTS (
        SELECT 1 FROM company_ownership co
        WHERE co.child_brand_id = brands.id
      )
    )
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;
```

---

### Problem 3: Missing Shareholder Enrichment

**Current State:**
- No function exists
- No data source configured
- Table empty

**Wikidata Options:**
- P1830 (owner of) - but usually for full ownership
- P121 (item operated) - for subsidiaries
- No reliable shareholder % data in Wikidata

**Alternative Sources:**
- Yahoo Finance API (free tier exists)
- SEC EDGAR for US public companies
- Manual data entry for key brands

**Recommendation:**
Create `enrich-shareholders` function:
```typescript
// For US public companies with ticker
1. Query SEC Form 13F filings
2. Extract institutional holders
3. Calculate % from shares outstanding
4. Flag asset managers (BlackRock, Vanguard, etc.)
5. Insert into company_shareholders

// For other public companies
1. Try Yahoo Finance API
2. Fallback to manual flag
```

---

## Recommended Action Plan

### Phase 1: Consolidation (Week 1)
1. Delete `enrich-ownership` function
2. Delete `enrich-key-people` function
3. Keep only `enrich-brand-wiki` + `enrich-company-profile`
4. Update `enrich-brand-wiki` to use new schema
5. Migrate existing data to new tables

### Phase 2: Batch Processing (Week 2)
1. Add batch mode to `resolve-brand-logo`
2. Create batch runner for key people
3. Run batch enrichment for all 77 brands

### Phase 3: Shareholders (Week 3)
1. Create `enrich-shareholders` function
2. Integrate SEC EDGAR for US public companies
3. Add Yahoo Finance fallback
4. Run for 20 public companies

### Phase 4: Quality & Monitoring (Week 4)
1. Add confidence scores to all enrichment
2. Create enrichment dashboard
3. Set up weekly batch jobs
4. Monitor coverage metrics

---

## Coverage Targets (Post-Implementation)

| Feature | Current | Target | Priority |
|---------|---------|--------|----------|
| Descriptions | 91% (70/77) | 100% | Medium |
| Logos | 21% (16/77) | 95% | High |
| Parent Company | 0% (0/77) | 90% | **CRITICAL** |
| Key People | 1.3% (1/77) | 85% | **CRITICAL** |
| Shareholders | Unknown | 100% public cos | High |
| Scores | 100% | 100% | ✅ Done |

---

## Function Health Report Card

| Function | Grade | Reason | Action |
|----------|-------|--------|--------|
| enrich-brand-wiki | B | Works but complex | Simplify |
| resolve-brand-logo | A- | Clean, needs batch | Add batch mode |
| enrich-ownership | F | **DELETE** redundant | 🗑️ Delete |
| enrich-key-people | F | **DELETE** redundant | 🗑️ Delete |
| enrich-company-profile | B | Good but overlaps | Keep, refine |
| enrich-shareholders | N/A | **MISSING** | 🔨 Create |
