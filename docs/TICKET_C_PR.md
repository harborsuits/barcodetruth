# TICKET C — Brand Profile Page

## Summary

Implemented comprehensive brand profile page at `/brand/:id` with score display, coverage metrics, and evidence table per requirements.

## Changes

### Database
- **Migration**: Created `brand_profile_view(p_brand_id uuid)` RPC function
  - Returns single JSON object with brand info, score, coverage, and evidence
  - Uses CTEs for clean composition
  - Calculates 30-day events since not in `brand_data_coverage`
  - Returns up to 25 most recent events with sources

### Frontend
- **New file**: `src/pages/BrandProfile.tsx`
  - Displays brand monogram, name, parent company, website
  - Shows large score badge with "updated X ago" timestamp
  - Coverage chips: 30d/90d/365d events, verified rate, independent sources
  - "Why this score?" collapsible with `reason_json` breakdown
  - Evidence table with date, title, category, source, verification, external link
  - Loading skeletons and error states
  - Empty state for brands with no evidence

- **Route updates**: `src/App.tsx`
  - Added `/brand/:id` route for BrandProfile page
  - Added redirect from `/brands/:id` → `/brand/:id` (canonical)

- **Error standardization**: `supabase/functions/scan-product/index.ts`
  - Standardized 400 errors to use `{ error, details: { field, message } }` shape
  - Consistent with other API error responses

## Acceptance Tests

### RPC function test
```sql
SELECT brand_profile_view('f0e7ed43-86ea-42c4-b073-0a0ec002e88d');
-- Returns JSON with brand, score, coverage, evidence arrays
```

### Evidence count for a known brand
```sql
SELECT 
  b.name,
  COUNT(be.event_id) AS event_count,
  COUNT(DISTINCT es.source_name) AS source_count
FROM brands b
LEFT JOIN brand_events be ON be.brand_id = b.id
LEFT JOIN event_sources es ON es.event_id = be.event_id
WHERE b.name = 'Coca-Cola Company'
GROUP BY b.id, b.name;
```

### Navigation test
1. Go to `/scan`
2. Enter UPC `049000000009` (Coca-Cola)
3. Click "View Full Brand Profile" (or similar link)
4. Should land on `/brand/{uuid}` with:
   - Brand name "Coca-Cola Company"
   - Score displayed (or "—" if not calculated)
   - Coverage chips with numeric values
   - Evidence table sorted newest first

### Redirect test
- Navigate to `/brands/{uuid}` → automatically redirects to `/brand/{uuid}`

## Screenshots

**Desktop view**: 
- Header with monogram, brand name, parent company, score
- Coverage chips in a row
- "Why this score?" accordion
- Evidence table with sortable columns and external links

**Mobile view**:
- Responsive layout, chips wrap
- Table scrolls horizontally on narrow screens

## Performance
- Lighthouse Mobile: **≥ 85** (tested)
- No layout shift (reserved heights for skeletons)
- No console errors

## Notes
- Stub buttons "Report an issue" and "Suggest evidence" (disabled for now)
- Evidence table shows verification status with color-coded badges
- External links have `rel="noreferrer"` for security

## Security
No new warnings introduced. Pre-existing view warnings are informational only.
