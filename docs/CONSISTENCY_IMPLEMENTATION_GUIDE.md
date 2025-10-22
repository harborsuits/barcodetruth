# Brand Profile Consistency Implementation Guide

## Overview
This guide ensures all brands in the app display the same high-quality, feature-complete profiles as the Walmart reference standard.

---

## Phase 1: Database Schema Validation ✓

All required tables exist and have proper RLS policies:
- ✅ `brands` - Core brand data
- ✅ `brand_scores` - Category scores (defaults to 50)
- ✅ `brand_events` - Evidence feed
- ✅ `companies` - Parent company details
- ✅ `company_ownership` - Control relationships
- ✅ `company_people` - Executives and founders
- ✅ `company_shareholders` - Institutional investors only
- ✅ `company_valuation` - Market cap data

All required RPC functions exist:
- ✅ `brand_profile_view(brand_id)`
- ✅ `get_brand_ownership(brand_id)`
- ✅ `get_brand_company_info(brand_id)`
- ✅ `get_top_shareholders(brand_id, limit)`

---

## Phase 2: Enrichment Pipeline Requirements

### Auto-Enrichment Process
The `BrandWikiEnrichment` component runs automatically on every brand profile view and triggers:

```typescript
// Enrichment triggers when:
if (!hasDescription || !hasParentCompany) {
  supabase.functions.invoke('enrich-brand-wiki?brand_id=${brandId}')
}
```

### Required Enrichment Data

#### 1. Wikipedia Data (Primary)
- Brand description (200 chars)
- Wikipedia QID
- Logo URL
- Description language (default: 'en')

#### 2. Wikidata Ownership (Secondary)
- Parent company name & QID
- Create/link company record
- Store ownership relationship with type='control'

#### 3. Key People (Tertiary)
For each person:
```sql
INSERT INTO company_people:
- company_id (parent company)
- role (chief_executive_officer, chairperson, founder)
- person_name (full name)
- person_qid (Wikidata Q-number)
- image_url (Wikimedia Commons URL)
- source ('wikidata')
- source_ref (Wikipedia article URL)
- confidence (0.8-1.0)
```

**CRITICAL**: Wikipedia URLs must be constructed as:
```
https://en.wikipedia.org/wiki/${person_name.replace(/ /g, '_')}
```
NOT Wikidata entity pages!

#### 4. Shareholders (Public Companies Only)
For each top holder:
```sql
INSERT INTO company_shareholders:
- company_id
- holder_name
- holder_type ('institutional' | 'insider')
- percent_owned
- holder_url (official website)
- wikipedia_url (en.wikipedia.org)
- source ('sec_13f' | 'proxy' | 'wikidata')
- as_of (date)
```

**CRITICAL**: Never add asset managers to `company_ownership`. They go in `company_shareholders` only!

---

## Phase 3: UI Component Standards

### 1. Brand Header Component
```tsx
// REQUIRED: Logo with fallback
<BrandLogoWithFallback 
  logoUrl={brand.logo_url} 
  website={brand.website}
  brandName={brand.name}
  monogram={brand.name[0]}
/>

// REQUIRED: Wikipedia description
{description ? (
  <p>{description.substring(0, 200)}...</p>
) : (
  <div className="animate-pulse">●</div>
  <span>Auto-enriching from Wikipedia...</span>
)}
```

### 2. Scoring Components
```tsx
// ALWAYS show all 4 categories with default=50
<CategoryScoreCard 
  category="labor"
  score={score_labor ?? 50}  // ← DEFAULT TO 50
  eventCount={eventCount}
/>
```

### 3. Ownership Module
```tsx
// New unified component structure:
<OwnershipTabs brandId={brandId}>
  {/* Main ownership card */}
  <UnifiedOwnershipDisplay
    company={parentCompany}
    shareholders={NOT USED HERE}
    ownershipDetails={details}
    parentChain={chain}
    siblings={siblings}
  />
  
  {/* Key people - separate card */}
  <KeyPeopleRow people={companyInfo.people} />
  
  {/* Shareholders - separate card */}
  <TopShareholdersCard shareholders={shareholders} />
</OwnershipTabs>
```

**CRITICAL**: Shareholders are displayed SEPARATELY from ownership structure with clear disclaimer about passive investment.

### 4. Key People Links
```tsx
// Construct Wikipedia URL from person name
<a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(person.name.replace(/ /g, '_'))}`}>
  {person.name}
</a>
```

---

## Phase 4: Data Quality Checks

### Required for Every Brand

1. **Logo Resolution**
   - Attempted via `resolve-brand-logo` function
   - Falls back to monogram if not found

2. **Description**
   - Auto-fetched from Wikipedia
   - Max 200 characters displayed
   - Source link included

3. **Parent Company**
   - Fetched from Wikidata if available
   - Stored in `company_ownership` with relationship_type='control'
   - Never contains asset managers

4. **Key People**
   - Minimum: CEO if available
   - Bonus: Founder(s), Chairperson
   - Photos from Wikimedia Commons
   - Links to English Wikipedia

5. **Shareholders** (Public Companies Only)
   - Top 10 institutional holders
   - Clear "Asset Manager" badges
   - Separate from ownership structure

6. **Scores**
   - Always display all 4 categories
   - Default to 50 when no events
   - Update via scoring pipeline

---

## Phase 5: Testing Checklist

For each brand added:

```
□ Brand name renders correctly
□ Logo displays or monogram shows
□ Wikipedia description loaded
□ Website link works (if available)
□ All 4 category scores show (default 50)
□ Data collection badge shows correctly
□ Ownership card renders:
  □ Parent company name
  □ Company logo
  □ Ownership structure
  □ Sister brands (if any)
□ Key people section:
  □ Photos load
  □ Names display
  □ Wikipedia links work (English)
  □ Roles show correctly
□ Shareholders (if public):
  □ Top 10 list
  □ Percentages shown
  □ Asset manager badges
  □ Disclaimer visible
□ Valuation chip (if public)
□ Coverage metrics accurate
□ Evidence feed loads
□ No console errors
□ Mobile responsive
□ Dark mode correct
```

---

## Phase 6: Common Issues & Fixes

### Issue: Wikipedia links go to wrong language
**Root Cause**: Using Wikidata entity pages instead of Wikipedia articles
**Fix**: Construct URL from person name:
```typescript
`https://en.wikipedia.org/wiki/${person.name.replace(/ /g, '_')}`
```

### Issue: Asset managers shown as parent companies
**Root Cause**: Mixing shareholders with control relationships
**Fix**: 
- `company_ownership` = control only (relationship IN ('parent', 'subsidiary'))
- `company_shareholders` = investors only (holder_type = 'institutional')

### Issue: Key people missing photos
**Root Cause**: Wikidata query not fetching images
**Fix**: Update enrichment to fetch P18 (image) property from Wikidata

### Issue: Scores not showing
**Root Cause**: No events = no score calculated
**Fix**: Always default to 50 when score is null

### Issue: Enrichment not running
**Root Cause**: Component conditions not met
**Fix**: Check both `!hasDescription` AND `!hasParentCompany`

---

## Phase 7: Deployment Checklist

Before marking a brand as "production ready":

1. Run enrichment edge function manually
2. Verify all data populated in database
3. Load brand profile in UI
4. Complete testing checklist (Phase 5)
5. Check in mobile view
6. Check in dark mode
7. Verify all external links
8. Document any missing data

---

## Monitoring & Maintenance

### Weekly Checks
- Run enrichment status query
- Check for brands with missing descriptions
- Verify key people data completeness
- Update shareholder data for public companies

### Monthly Checks
- Validate Wikipedia link accuracy
- Update market cap valuations
- Refresh shareholder percentages
- Audit control relationships

### Quarterly Checks
- Full data quality audit
- Update Wikidata QIDs
- Refresh all enrichment data
- Review and update this guide

---

## Success Metrics

A brand profile meets the Walmart standard when:
- ✅ All 11 feature sections render
- ✅ No "missing data" placeholders
- ✅ All external links work correctly
- ✅ Loading time < 2 seconds
- ✅ No console errors
- ✅ Mobile + dark mode correct
- ✅ Passes all testing checklist items
