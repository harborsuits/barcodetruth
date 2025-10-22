# Walmart Standard Implementation Status

**Status**: ✅ Shippable code deployed

This document tracks the implementation of the Walmart brand profile standard across all 76 brands.

---

## What Was Shipped

### 1. UI Primitives (Drop-in Components)

All brands now render "complete" even with sparse data:

- ✅ `Description.tsx` - Shows loading state, truncates to 200 chars, includes Wikipedia source link
- ✅ `ScoresGrid.tsx` - Always shows all 4 categories with default value of 50
- ✅ `OwnershipSimple.tsx` - Shows control relationships with graceful empty state
- ✅ `KeyPeopleSimple.tsx` - Renders executives/founders with Wikipedia links from names
- ✅ `ShareholdersSimple.tsx` - Shows institutional investors with "Asset Manager" badges and disclaimer

### 2. Database Hardening

**Coverage Tracking**:
- ✅ `brand_profile_coverage` view - Tracks 5 key metrics per brand
- ✅ RLS enabled with `security_invoker = true`

**Data Quality Constraints**:
- ✅ `forbid_asset_managers_as_parents()` trigger - Prevents BlackRock/Vanguard/State Street/Fidelity/Invesco from `company_ownership` table
- ✅ `ensure_default_scores()` function - Guarantees all brands have scores (defaults to 50)
- ✅ `auto_create_default_scores()` trigger - Runs on brand INSERT
- ✅ Backfilled all 76 active brands with default scores

**Performance**:
- ✅ 4 new indexes on ownership/people/shareholders tables

### 3. Gap Detection (SQL Queries)

Created `scripts/walmart_standard_gaps.sql` with 8 queries:
1. Missing descriptions
2. Missing parent companies
3. Missing key people ← **Biggest gap (3% coverage)**
4. Public companies without shareholders
5. Missing category scores
6. Overall coverage dashboard
7. Complete profiles list
8. Prioritization by completeness score

### 4. Testing Infrastructure

- ✅ `tests/brandProfile.spec.ts` - Playwright smoke test
  - Verifies all Walmart standard sections render
  - Checks dark mode
  - Catches console errors
  - Validates 4 category scores present

---

## Current Coverage (Post-Deployment)

Run this query to see live stats:

```sql
SELECT * FROM brand_profile_coverage WHERE brand_id = '5b465261-bca1-41c1-9929-5ee3a8ceea61'; -- Walmart
```

Expected results across all brands:

| Metric | Target | Actual | Gap |
|--------|--------|--------|-----|
| Descriptions | 100% | 92% | 6 brands |
| Parent Companies | 100% | 99% | 1 brand |
| Key People | 100% | **3%** | **74 brands** ← Priority |
| Shareholders (public only) | 100% | TBD | TBD |
| All 4 Scores | 100% | **100%** ✅ | 0 (fixed by migration) |

---

## Next Steps (In Priority Order)

### Week 1: Fix Descriptions (Fast Win)
```sql
-- Find the 6 brands
SELECT id, name FROM brands WHERE is_active = true AND COALESCE(LENGTH(description), 0) < 40;
```
**Action**: Run `enrich-brand-wiki` edge function for each

### Week 2-3: Add Key People (Biggest Impact)
**Phase A**: Top 10 brands (CEO only is acceptable)
**Phase B**: All remaining 74 brands

Use the enrichment edge function with proper SPARQL query:
```sparql
SELECT ?person ?personLabel ?image WHERE {
  VALUES ?prop { wd:P169 wd:P112 wd:P488 }  # CEO, Founder, Chair
  wd:${qid} ?p ?statement .
  ?statement ?ps ?person .
  ?p wikibase:directClaim ?prop .
  OPTIONAL { ?person wdt:P18 ?image }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
```

### Week 4: Add Shareholders (Public Companies Only)
- Query which brands are public via `companies.is_public`
- Fetch institutional investors from SEC or Wikidata
- Store in `company_shareholders` with `holder_type = 'institutional'`
- Set `is_asset_manager = true` for known asset managers

---

## Edge Cases Handled

1. **Asset Manager Bleed**: Trigger blocks BlackRock/Vanguard/etc from `company_ownership`
2. **Missing Scores**: All brands now default to 50 for all 4 categories
3. **Wikipedia Links**: Constructed from person names, not Wikidata QIDs
4. **Photo URLs**: Prefer Wikimedia Commons P18 property
5. **Private Companies**: Hide shareholders section entirely

---

## Validation Checklist

For each brand, verify:

- [ ] Logo displays or shows monogram fallback
- [ ] Description renders with "Source" link or loading state
- [ ] All 4 category scores show (default 50 if no events)
- [ ] Ownership card shows parent or "No control relationships" message
- [ ] Key people section renders (once enrichment runs)
- [ ] Shareholders section only shows for public companies
- [ ] Wikipedia links open to English articles
- [ ] No asset managers in ownership card
- [ ] Mobile responsive
- [ ] Dark mode correct

Run the Playwright test to automate this:
```bash
npx playwright test tests/brandProfile.spec.ts
```

---

## Monitoring

**Weekly**: Run `scripts/walmart_standard_gaps.sql` query #6 for coverage dashboard

**Monthly**: Check for new asset managers in `company_ownership`:
```sql
SELECT co.*, c.name 
FROM company_ownership co
JOIN companies c ON c.id = co.parent_company_id
WHERE c.name ILIKE ANY(ARRAY['%BlackRock%', '%Vanguard%', '%State Street%']);
```
Should return 0 rows.

**Quarterly**: Full data quality audit with query #8 (prioritization by completeness)

---

## Success Criteria

A brand meets the Walmart standard when:
- ✅ All 5 sections render (even if empty state)
- ✅ No console errors
- ✅ All external links work
- ✅ Loading time < 2 seconds
- ✅ Mobile + dark mode correct
- ✅ Passes Playwright test

**Target Date for 100% Coverage**: 4 weeks from deployment
