# Phase 2 QA Script

## EPA Ingestion Validation

### Check Fresh Events
```sql
-- Look at fresh events for a given brand
SELECT 
  event_id, 
  brand_id, 
  category, 
  verification, 
  orientation, 
  impact_environment, 
  event_date, 
  occurred_at,
  source_url
FROM brand_events
WHERE brand_id = 'YOUR_BRAND_ID' 
ORDER BY COALESCE(event_date, occurred_at) DESC
LIMIT 5;
```

Expected:
- `category` = 'environment'
- `verification` = 'official'
- `orientation` = 'negative'
- `impact_environment` = -1, -3, or -5
- `source_url` populated with EPA ECHO URL
- `occurred_at` auto-generated from `event_date`

### Confirm Sources
```sql
SELECT 
  e.event_id, 
  e.source_url as event_source_url,
  s.source_name, 
  s.source_url, 
  s.source_date
FROM brand_events e
JOIN event_sources s ON s.event_id = e.event_id
WHERE e.brand_id = 'YOUR_BRAND_ID'
ORDER BY s.source_date DESC
LIMIT 5;
```

Expected:
- `source_name` = 'EPA ECHO'
- `source_url` matches EPA facility detail page
- Both `event_source_url` and `source_url` should match

### Dedupe Test
1. Run `fetch-epa-events` for a brand
2. Note the `event_ids` returned
3. Run the function again immediately
4. Confirm: `inserted: 0` (no duplicates created)
5. Check logs for "Skipping duplicate" messages

## "Why This Score?" Validation

### On Scan Result Page
Navigate to `/scan-result/:barcode` for a brand with EPA events.

**Expected Behavior:**
- "Score Drivers" section appears under Value Fit bar
- Shows up to 4 categories with negative impacts
- Each chip shows:
  - Category name (colored)
  - Integer impact value (e.g., "-5" not "-5.2")
  - Event count
  - Expand/collapse chevron
- Clicking expands to show up to 3 EventCards with:
  - EPA ECHO source attribution
  - Clickable source URLs
  - Proper verification badges

**Empty State:**
If no negative drivers in last 12 months:
- Section still renders
- Shows: "No recent negative drivers found in the last 12 months."
- Displays data sources footnote

**Footer:**
- "Based on verified events from the last 12 months. Data sources: EPA ECHO (official)."

## Alternatives Rationale Validation

### Same-Category Alternatives
On `/scan-result/012345678905`:

1. Open "Better Alternatives" drawer
2. Check each alternative shows specific rationale:
   - Positive delta: `"+N better: Better on Environment (+18), Worse on Labor (−4)"`
   - Negative delta: `"−N points: Worse on Environment (−12), Better on Labor (+6)"`
   - Zero delta: `"Similar values: [explanation]"`

### Fallback Path
1. Change scanned product category to unique value:
   ```sql
   UPDATE products SET category = 'unique-test-category' 
   WHERE barcode = '012345678905';
   ```
2. Reload scan result page
3. Drawer description should say: "No same-category options yet — showing generally better-aligned brands"
4. Still shows ranked alternatives by Value Fit

## Performance Checks

### Mobile Throttling Test
1. Open DevTools → Network → Enable "Fast 3G" throttling
2. Navigate to scan result page
3. Open alternatives drawer
4. Click "Compare" on an alternative

**Expected:**
- Drawer opens quickly (<300ms perceived)
- Compare sheet renders without jank
- No layout shift during load
- Images/data load progressively

### Database Query Performance
Check Supabase dashboard logs:
- `/scan-result` page load queries should complete <150ms
- `fetch-epa-events` function should complete <3s for 10 facilities
- No N+1 query patterns

## Index Verification

```sql
-- Confirm indexes exist
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('brand_events', 'event_sources')
ORDER BY tablename, indexname;
```

Expected indexes:
- `idx_brand_events_brand_time`
- `idx_brand_events_brand_occurred`
- `idx_brand_events_impact`
- `idx_event_sources_url`
- `idx_event_sources_event_id`
- `uq_brand_event_source` (unique)

## RLS & Permissions Check

### Service Role (Edge Function)
```sql
-- Service role should bypass RLS, but verify inserts work
-- This is done via the fetch-epa-events function itself
```

### Authenticated Users
Open browser in private mode, log in, navigate to scan result:
- Should see events
- Should NOT be able to insert events directly
- Should see alternatives and compare data

## Known Issues to Document

### Pre-existing Security Linter Warnings
These are INFO/WARN level and pre-date Phase 2:
- RLS enabled with no policies on some tables (acceptable for public read)
- pg_trgm extension in public schema (common pattern)

### Timestamp Migration
- `event_date` is canonical field
- `occurred_at` is auto-generated for backwards compatibility
- Both work in queries, prefer `event_date` going forward

## Test Brands for EPA

Brands likely to have EPA data:
- Any major manufacturing company
- Automotive brands
- Chemical/oil companies
- Food processing companies

To seed test data manually:
```sql
-- Insert a test brand if needed
INSERT INTO brands (name) VALUES ('Test Manufacturing Co') RETURNING id;

-- Run fetch-epa-events via edge function
-- POST to: /functions/v1/fetch-epa-events?brand_id=<UUID>
```
