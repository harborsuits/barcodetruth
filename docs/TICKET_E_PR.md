# TICKET E: Search (Debounced + Fuzzy)

## Overview
Implemented a fast, fuzzy search feature for products and brands with 300ms debounce and trigram-based similarity matching.

## Database Changes

### Migration: Search Infrastructure
```sql
-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram indexes for fast similarity search
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_brands_name_trgm ON brands USING gin (name gin_trgm_ops);

-- RPC for unified catalog search
CREATE OR REPLACE FUNCTION search_catalog(p_q text, p_limit int DEFAULT 20)
RETURNS jsonb
```

**Key features:**
- Combines ILIKE (exact substring) + similarity (fuzzy) matching
- Returns top matches per category (products, brands)
- Similarity threshold: 0.3 (captures typos like "peps" → "pepsi")
- Single RPC call reduces round-trips

## Frontend Implementation

### New Files
1. **src/pages/Search.tsx**
   - Debounced search input (300ms)
   - Tabs for Products / Brands results
   - Click handlers: Products → `/scan?prefill={name}`, Brands → `/brand/:id`
   - Empty state messaging

2. **src/hooks/useDebounce.ts**
   - Generic debounce hook with configurable delay
   - Default 300ms latency

### Route Integration
- Route already exists at `/search` in App.tsx
- Supports query param: `/search?q=query`

## Acceptance Tests

### 1. Query: "coca"
```sql
SELECT * FROM search_catalog('coca', 20);
-- Expected: Coca-Cola products and brand in results
```

### 2. Query: "peps" (typo)
```sql
SELECT * FROM search_catalog('peps', 20);
-- Expected: Pepsi products/brand (fuzzy match)
```

### 3. Query: "detergent"
```sql
SELECT * FROM search_catalog('detergent', 20);
-- Expected: Tide, Downy, etc. products with "detergent" in category/name
```

### 4. Performance Check
- Open `/search`, type query
- Verify results appear <300ms after typing stops (check Network tab timing)
- No requests while typing (debounce working)

### 5. UI Flow
- Click product result → redirects to `/scan` with prefilled name
- Click brand result → redirects to `/brand/:id`

## Pre-existing Security Notes
The migration tool flagged several pre-existing warnings:
- Security definer views (not from this migration)
- Function search path (our new function correctly has `SET search_path = public`)
- Materialized view in API (existing `brand_data_coverage`)
- Leaked password protection (auth config)

**None of these were introduced by this ticket.** All security best practices followed for new code.

## Merge Checklist
- [x] Database migration applied successfully
- [x] GIN indexes created
- [x] RPC function deployed with length check optimization (length(p_q) >= 3)
- [x] Search page implemented with debounce (300ms) and tabs
- [x] Route configured in App.tsx
- [x] Products use UPC link to /scan?upc=${barcode}
- [x] searchCatalog utility created with typed responses
- [ ] Test queries "coca", "peps", "detergent" return results <300ms
- [ ] UI navigation works (product → scan with UPC, brand → profile)
- [ ] No console errors on empty query or no results

---

**Ready to merge after acceptance tests pass.**
