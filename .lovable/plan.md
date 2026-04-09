

# Fix Barcode Normalization Bug

## Problem
12-digit UPCs (e.g., `037000089872`) fail to resolve because the database stores barcodes inconsistently — some as 12-digit UPC-A, some as 13-digit EAN-13. The current lookup functions don't cover all format permutations.

## Root Cause
Two RPC functions have incomplete normalization:

1. **`get_product_by_barcode`** — matches `raw` OR `normalize(raw)` (which pads 12→13), but never tries stripping a leading zero from a 13-digit input to match a 12-digit stored barcode
2. **`scan_product_lookup`** — does only exact match (`WHERE p.barcode = p_upc`), no normalization at all

## Fix

### Single database migration that updates both functions:

**`get_product_by_barcode`** — change the WHERE clause to match on 3 variants:
- Raw input as-is
- Normalized (12→13 padded)
- Stripped (if 13 digits starting with '0', try the 12-digit version)

**`scan_product_lookup`** — same 3-variant WHERE clause using `normalize_barcode()` plus the strip-leading-zero fallback.

```sql
WHERE pbp.barcode IN (
  p_raw_gtin,                                    -- exact match
  public.normalize_barcode(p_raw_gtin),           -- 12→13 padded
  CASE WHEN length(regexp_replace(p_raw_gtin, '\D', '', 'g')) = 13 
       AND regexp_replace(p_raw_gtin, '\D', '', 'g') LIKE '0%'
       THEN substring(regexp_replace(p_raw_gtin, '\D', '', 'g') FROM 2)  -- 13→12 stripped
       ELSE NULL END
)
```

### No edge function changes needed
Both `get-product-by-barcode/index.ts` and `scan-product/index.ts` pass the barcode straight to the RPC — the fix is entirely in the SQL functions.

### No frontend changes needed
The frontend already sends the raw barcode to the edge functions.

## Test Cases
- `037000089872` (12-digit) → resolves via pad to `0037000089872`
- `0037000089872` (13-digit) → resolves via exact or strip to `037000089872`
- `028400064057` (12-digit) → resolves
- `999999999999` → returns notFound gracefully

## Files Changed

| File | Action |
|------|--------|
| New SQL migration | Update both `get_product_by_barcode` and `scan_product_lookup` functions |

One migration, zero edge function changes, zero frontend changes.
