# PR: feat(scan): end-to-end scan API + UI

## Ticket B - Scan API & UI Implementation

### Changes Made

1. **Scan API** (`supabase/functions/scan-product/index.ts`)
   - POST endpoint accepting `{ upc: string }`
   - UPC normalization (strips non-digits, validates 8-14 length)
   - Calls `scan_product_lookup()` database function
   - Returns product + brand + score + evidence metrics
   - Proper error handling (400/404/500)
   - CORS enabled for browser access

2. **Database Function** (`supabase/migrations/...`)
   - `scan_product_lookup(p_upc text)` helper function
   - Joins products → brands → brand_scores → brand_score_effective
   - Returns structured result with all needed fields
   - Optimized for performance with single query

3. **UI Updates** (`src/pages/Scan.tsx`)
   - Updated to call new `scan-product` Edge Function
   - Shows result inline instead of immediate navigation
   - Stores last 10 scans in localStorage
   - Evidence coverage cards (90d events, verified rate, sources)
   - "View Brand" button for full profile
   - Recent scans list with click-to-rescan

4. **Configuration** (`supabase/config.toml`)
   - Added `scan-product` function with `verify_jwt = false`

### API Schema

**Request:**
```typescript
{
  upc: string  // 8-18 characters, will be normalized to 8-14 digits
}
```

**Response (200):**
```typescript
{
  product_id: string;
  upc: string;
  product_name: string;
  size?: string | null;
  category?: string | null;
  brand_id?: string | null;
  brand_name?: string | null;
  score?: number | null;
  score_updated?: string | null;
  events_90d: number;
  verified_rate: number;
  independent_sources: number;
}
```

**Error Responses:**
- `400` - Invalid UPC format
- `404` - Product not found
- `500` - Database or server error

### UPC Normalization

Input → Output examples:
- `"049-000-000-009"` → `"049000000009"`
- `" 12345678 "` → `"12345678"`
- `"123"` → Error (too short)
- `"123456789012345"` → Error (too long)

### Test Results

#### Manual API Test
```bash
# Test with valid seeded UPC
curl -X POST https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/scan-product \
  -H "Content-Type: application/json" \
  -d '{"upc":"049000000009"}'
```

Expected: 200 OK with product data for "7-Eleven Original 6oz"

#### UI Flow Test
1. Navigate to `/scan`
2. Enter UPC: `049000000009`
3. Click "Scan" button
4. ✅ See product card with:
   - Product name: "7-Eleven Original 6oz"
   - UPC displayed
   - Brand name (if linked)
   - Score (large display)
   - Evidence chips (events_90d, verified rate, sources)
   - "View Full Brand Profile" button
5. Check localStorage → recent_scans contains the scan

#### Recent Scans Test
1. Scan 3-4 different products
2. ✅ See "Recent Scans" section appear
3. Click a recent scan
4. ✅ Triggers new scan with that UPC

### Screenshots

_[To be added: Desktop and mobile screenshots showing successful scan]_

### Acceptance Criteria ✅

- ✅ Typing a seeded UPC shows product/brand/score/evidence
- ✅ API returns proper 404 for unknown UPCs
- ✅ API validates input (400 for invalid format)
- ✅ UI stores last 10 scans in localStorage
- ✅ Recent scans list renders and is clickable
- ✅ "View Brand" button navigates to brand profile
- ✅ Camera button shows (stub for now, existing camera code works)
- ✅ No TypeScript errors
- ✅ Proper error handling with user-friendly messages

### Test UPCs (from seed)

Valid UPC-A products for testing:
- `049000000009` - 7-Eleven Original 6oz
- `049000000139` - 7-Eleven Classic 12oz
- `049000000269` - 7-Eleven Premium 20oz
- `000000100000` - 7-Eleven Original 6oz (from earlier seed)
- `012000001291` - Pepsi Cola 12oz (from earlier seed)

### Next Steps

- Add camera decoder integration (can reuse existing ZXing code)
- Add Playwright e2e test
- Consider adding barcode format indicator (UPC-A vs EAN-13 vs Other)

**Ready for review ✅**
