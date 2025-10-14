# PR: fix(products): checksum realism + indexes

## Ticket A2 - Checksum Realism & Indexes

### Changes Made

1. **Schema Updates** (`supabase/migrations/20251014_054847_add_checksum.sql`)
   - Added `upc_type` column (enum: 'upc-a', 'ean-13', 'other')
   - Added `valid_checksum` boolean column
   - Created `upc_check_digit()` function for UPC-A validation
   - Added index on `brand_id` for faster joins
   - Verified unique constraint on `barcode`

2. **Valid Products Generated** (`supabase/migrations/20251014_055151_seed_valid_upcs.sql`)
   - Generated 300 products with mathematically valid UPC-A codes
   - Check digits calculated using standard UPC-A algorithm
   - Distributed across 15 existing brands

3. **Documentation**
   - Updated `scripts/verify_seed.sql` with checksum breakdown query

### Acceptance Criteria ✅

```sql
-- Test: UPC type and checksum distribution
SELECT upc_type, valid_checksum, COUNT(*) 
FROM products GROUP BY 1,2 ORDER BY 1,2;
```

**Results:**
- ✅ 300 products with `upc_type='upc-a'` and `valid_checksum=true`
- ✅ 1,212 products with `upc_type='other'` (from initial seed)
- ✅ Total: 1,512 products

**Sample Valid UPCs for Testing:**
- `049000000009` - 7-Eleven Original 6oz
- `049000000139` - 7-Eleven Classic 12oz  
- `049000000269` - 7-Eleven Premium 20oz
- `049000000399` - 7-Eleven Original 1L
- `049000000528` - 7-Eleven Classic 2L

### Database Indexes

```sql
-- Verified indexes on products table
✅ products_barcode_key (UNIQUE) - for fast UPC lookups
✅ idx_products_brand - for brand joins
✅ idx_products_name_trgm - for text search
```

### UPC Check Digit Algorithm

The `upc_check_digit()` function implements the standard UPC-A algorithm:
1. Sum digits at odd positions (1,3,5,7,9,11) × 3
2. Sum digits at even positions (2,4,6,8,10)
3. Check digit = (10 - ((sum_odd + sum_even) mod 10)) mod 10

### Next Steps

This PR provides the foundation for:
- Scanner confidence indicators (show ⚠️ for experimental/invalid codes)
- UPC normalization (8/12/13/14 digit handling in API)
- Future: EAN-13 support with separate check digit algorithm

**Ready for merge ✅**
