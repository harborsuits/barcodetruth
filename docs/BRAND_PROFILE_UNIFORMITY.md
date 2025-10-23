# Brand Profile Uniformity System

## Overview

This document describes the uniformity system that ensures all brand profiles display the same feature set (ownership, key people, shareholders) regardless of data completeness. The system provides graceful fallbacks and consistent empty states.

## Architecture

### 1. Database Layer: Resolver Views

Two resolver views provide parent-fallback logic at the SQL level:

#### `v_company_people_resolved`
Resolves key people with priority:
1. **Direct** - company_people records
2. **Parent fallback** - parent company's company_people records

Always returns empty set (never null) for consistent UI.

#### `v_company_shareholders_resolved`
Resolves shareholders with priority:
1. **Direct enriched** - company_shareholders records
2. **Parent enriched** - parent company's company_shareholders
3. **Direct fallback** - company_ownership_details records
4. **Parent fallback** - parent company's company_ownership_details

Always returns empty set (never null) for consistent UI.

### 2. RPC Layer: Stable Contracts

#### `rpc_get_key_people(entity_id uuid)`
Returns:
- `person_id` - UUID
- `full_name` - string
- `role` - string (chief_executive_officer, chairperson, founder)
- `image_url` - string | null
- `wikipedia_url` - string | null
- `person_qid` - Wikidata QID | null
- `source` - string
- `last_updated` - timestamp
- `data_source` - 'direct' | 'parent' | 'unknown'

#### `rpc_get_top_shareholders(entity_id uuid, result_limit int)`
Returns:
- `shareholder_id` - UUID | null
- `holder_name` - string
- `holder_type` - string
- `percent_owned` - numeric
- `as_of` - date | null
- `source` - string
- `last_updated` - timestamp
- `is_asset_manager` - boolean
- `holder_wikidata_qid` - string | null
- `wikipedia_url` - string | null
- `holder_url` - string | null
- `data_source` - 'direct' | 'parent' | 'details_direct' | 'details_parent' | 'unknown'

### 3. React Layer: Custom Hooks

#### `useKeyPeople(brandId)`
- Calls `rpc_get_key_people`
- Returns empty array on error (never throws)
- Caches for 30 minutes

#### `useTopShareholders(brandId, limit)`
- Calls `rpc_get_top_shareholders`
- Returns empty array on error (never throws)
- Caches for 30 minutes

### 4. UI Layer: Uniform Rendering

#### `OwnershipTabs` Component
Always renders three cards:
1. **Ownership Card** - Shows parent/control relationships
2. **Key People Card** - Always visible with empty state
3. **Shareholders Card** - Always visible with empty state

#### Empty State Messages
- **Key People**: "No verified key people yet — we'll show parent data or filings as soon as they're available."
- **Shareholders**: "Ownership structure will appear as soon as we parse filings or parent data."

#### Loading States
Consistent skeleton loaders for all three cards during initial fetch.

## Data Provenance

Every row displays:
- **Source** badge (e.g., "Wikidata", "SEC", "Manual")
- **Data source** tooltip (direct, parent, details_direct, details_parent)
- **Last updated** timestamp

## Testing

### Test Scenarios

1. **Fully Enriched Brand**
   - Child has direct people & shareholders
   - Should display direct data only

2. **Partially Enriched Brand**
   - Child missing data, parent enriched
   - Should display parent data with provenance

3. **Fallback to Ownership Details**
   - No enriched data available
   - Should display company_ownership_details

4. **No Data Available**
   - All sources empty
   - Should display empty state messages

### QA Queries

```sql
-- Check people resolution for a brand
SELECT * FROM v_company_people_resolved 
WHERE company_id = '<brand_id>';

-- Check shareholder resolution for a brand
SELECT * FROM v_company_shareholders_resolved 
WHERE company_id = '<brand_id>';

-- Test RPC directly
SELECT * FROM rpc_get_key_people('<brand_id>');
SELECT * FROM rpc_get_top_shareholders('<brand_id>', 10);
```

## Files Modified

### Database
- Migration: `20251023025356_brand_profile_uniformity.sql`
  - Created `v_company_people_resolved` view
  - Created `v_company_shareholders_resolved` view
  - Created `rpc_get_key_people` function
  - Created `rpc_get_top_shareholders` function
  - Added performance indexes

### React Hooks
- `src/hooks/useKeyPeople.ts` - NEW
- `src/hooks/useTopShareholders.ts` - UPDATED

### React Components
- `src/components/brand/OwnershipTabs.tsx` - UPDATED (always render all cards)
- `src/components/brand/KeyPeopleRow.tsx` - UPDATED (empty state support)
- `src/components/brand/TopShareholdersCard.tsx` - UPDATED (empty state support)

## Monitoring

Key metrics to track:
- **Empty state rate** - % of brands showing empty states
- **Parent fallback rate** - % of brands using parent data
- **Data freshness** - Age of last_updated timestamps
- **Success rate** - % of brands with at least one data source

## Future Enhancements

1. **Freshness Indicators**
   - Green: ≤90 days
   - Amber: 91-365 days
   - Gray: >365 days or unknown

2. **Data Quality Badges**
   - ⚠️ Placeholder data
   - ✓ Verified data
   - ? Unverified data

3. **Auto-Refresh**
   - Trigger enrichment for brands with stale data
   - Batch refresh for brands missing data

4. **Coverage Dashboard**
   - Track % of brands with each feature
   - Monitor data quality trends over time
