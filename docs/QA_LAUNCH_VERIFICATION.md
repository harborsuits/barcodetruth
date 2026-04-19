# QA Launch Verification — Corrected & Reconciled

All counts/barcodes/routes below were queried against the live database and live `src/App.tsx` on 2026-04-19.

---

## Definitions (single source of truth)

**Strong brand** = `brand_scores.score < 47 OR > 53` AND `COUNT(brand_events) ≥ 5`.

Live counts (VERIFIED via `supabase--read_query`):
- `strong_all` = **73** (any status)
- `strong_active` = **4** (status='active') ← only these surface in the public catalog per `mem://architecture/catalog-gating-enforcement`
- `strong_active_categorized` = **4** (all 4 active strong brands have `category_slug`)

The earlier "8" and "41" numbers from prior summaries referred to (a) the active subset before category backfill and (b) the total category_slug updates across all-status strong brands. Use **73 / 4 / 4** going forward.

---

## Routes (VERIFIED from `src/App.tsx` lines 187–228)

| Purpose | Route | Auth |
|---|---|---|
| Scanner camera | `/scan` | Protected |
| Scan result by barcode | `/scan-result/:barcode` | Public |
| Unknown product flow | `/unknown/:barcode` | Protected |
| Brand profile | `/brand/:id` | Public |

No alternative routes exist. `/scan-result` (no param) also resolves but is for state-passed results.

---

## Test-Flow Rule (applies to Sections 1, 2, 4, 5)

**Any test that verifies a write path (`user_scans`, `unknown_barcodes`), the scanner lookup, or the OpenFoodFacts fallback MUST start at `/scan`** — because that write path lives in `src/lib/scannerLookup.ts`, which is invoked from `src/pages/Scan.tsx` (`handleConfirmedLookup` → `lookupScanAndLog`, line 249) and NOT from `/scan-result/:barcode` (which only renders state passed to it). Direct navigation to `/scan-result/:barcode` is allowed only for pure UI/render verification (Section 3 CTA wiring on an already-loaded weak result).

**Entry method** for every Section 1/2/4/5 test:
1. Navigate to `/scan` (Protected — log in first at `/auth`).
2. Click **"Enter barcode instead"** (VERIFIED button at `Scan.tsx` line 949).
3. Type the barcode into the **"Barcode number"** input (VERIFIED at `Scan.tsx` lines 866–882).
4. Click **"Look up"** (VERIFIED at `Scan.tsx` line 892, calls `handleManualSubmit` → `handleConfirmedLookup` → `lookupScanAndLog`).
5. The app navigates to `/scan-result/:barcode` (or the unknown flow) with state already populated.

This guarantees the `user_scans` insert (scannerLookup.ts:116–128) and the `log_unknown_barcode` RPC (scannerLookup.ts:100) actually fire.

---

## SECTION 1 — Strong Brand Tests (VERIFIED barcodes)

All three barcodes confirmed live: `b.status='active'`, score outside 47–53, ≥5 events, `category_slug='food-beverages'`.

| # | Barcode | Product | Brand | Score | Events | Source |
|---|---|---|---|---|---|---|
| S1 | `0024600010979` | Coarse Mediterranean Sea Salt | Morton | 43 | 18 | VERIFIED |
| S2 | `0024100717170` | Cheez-It Crackers | Sunshine | 46 | 19 | VERIFIED |
| S3 | `0847644005066` | READY CLEAN Bar | READY | 46 | 31 | VERIFIED |

### Steps (run for each)
1. Log in at `/auth`. Capture your user id from devtools (`localStorage` → `sb-...-auth-token` → `user.id`).
2. Go to `/scan` → **Enter barcode instead** → type the barcode → **Look up** (per Test-Flow Rule above).
3. App lands on `/scan-result/<barcode>`. Observe UI in `src/pages/ScanResultV1.tsx`.

### Expected UI (VERIFIED from `src/pages/ScanResultV1.tsx`)
- Numeric score badge visible (43, 46, 46)
- Verdict label rendered (per `mem://features/scan/trust-verdict-standard`: 43→"Mixed", 46→"Mixed")
- Reasons section populated from `brand_events`
- Alternatives section: rendered if `alternatives.length > 0`; otherwise the "Building evidence" card does NOT show (gated on baseline=true only)
- `RequestCoverageCTA` does NOT render

### Expected DB write (VERIFIED logic in `src/lib/scannerLookup.ts` lines 116–128)
```sql
-- Run as the logged-in user via Supabase SQL editor with role=authenticated, OR
-- run anonymously and filter by your known user_id:
SELECT id, user_id, barcode, brand_id, scanned_at
FROM user_scans
WHERE barcode = '0024600010979'
ORDER BY scanned_at DESC LIMIT 5;
```
Pass criteria: at least one row with your `user_id`, `barcode='0024600010979'`, `brand_id` matching Morton, `scanned_at` within last 5 minutes.

### If no row appears
1. Check console for `Failed to log scan:` warning (logged at line 126).
2. Verify session: `SELECT auth.uid();` returns non-null in your session.
3. Verify RLS: `SELECT * FROM pg_policies WHERE tablename='user_scans';` — must include an INSERT policy `WITH CHECK (auth.uid() = user_id)`.

---

## SECTION 2 — Weak/Baseline Brand Tests (VERIFIED barcodes)

All three barcodes confirmed live: `status='active'`, `score BETWEEN 47 AND 53`.

| # | Barcode | Product | Brand | Score | Events | Source |
|---|---|---|---|---|---|---|
| W1 | `0021000615261` | American (Singles) | Kraft Singles | 47 | 0 | VERIFIED |
| W2 | `0037466016450` | Dark Chocolate | Lindt | 49 | 6 | VERIFIED |
| W3 | `0070844705553` | Hokkien Stir-Fry Noodles | Ka Me | 50 | 0 | VERIFIED |

### Steps
1. Logged in. Go to `/scan` → **Enter barcode instead** → type the barcode → **Look up** (per Test-Flow Rule).
2. App lands on `/scan-result/<barcode>`.

### Expected UI (INFERRED from `src/pages/ScanResultV1.tsx` baseline branch + summary of last edit)
- Product identity card visible
- Parent company line visible if `brands.parent_company` non-null
- "Building evidence" card visible
- `RequestCoverageCTA` button visible with label "Request priority coverage"
- Alternatives list NOT shown
- Reasons section NOT shown
- No verdict badge / no numeric score for the brand-level component

### Expected DB write (same as Section 1)
A `user_scans` row is still inserted because the lookup succeeded (brand exists). Verify with the same query, swapping the barcode.

---

## SECTION 3 — Priority Coverage CTA (VERIFIED via migration `20260419200200_*.sql`)

### Steps
1. On a weak result page (use **W1** = `/scan-result/0021000615261`), click **"Request priority coverage"**.
2. Expect toast: `"Got it — we'll prioritize this brand."` (VERIFIED in `src/components/scan/RequestCoverageCTA.tsx` line 40).
3. Button switches to disabled "Added to priority queue" state.

### Expected DB writes
```sql
-- coverage_requests row (VERIFIED table exists per recent migration)
SELECT id, user_id, brand_id, brand_name, barcode, reason, created_at
FROM coverage_requests
WHERE barcode = '0021000615261'
ORDER BY created_at DESC LIMIT 3;

-- brand_enrichment_queue row (INFERRED — the request_brand_coverage RPC summary
-- claimed it bumps this queue; verify the RPC body to confirm):
SELECT id, brand_id, task, status, next_run_at, created_at
FROM brand_enrichment_queue
WHERE brand_id = (SELECT brand_id FROM products WHERE barcode='0021000615261')
ORDER BY created_at DESC LIMIT 3;
```

### Failure path
If the toast shows `"Couldn't submit just now."` → check `code--read_console_logs` for `request_brand_coverage failed`. Most likely cause: user not authenticated (line 27–30 short-circuits with toast `"Sign in to request priority coverage"`).

---

## SECTION 4 — Unknown Product Test (VERIFIED absent barcode)

VERIFIED via live query: `0000000000999` is absent from both `products` and `unknown_barcodes`. It will also miss OpenFoodFacts (non-conformant GTIN check digit).

### Steps
1. Logged in. Go to `/scan` → **Enter barcode instead** → type `0000000000999` → **Look up** (per Test-Flow Rule — direct visit to `/scan-result/0000000000999` would skip the `lookupScanAndLog` write path).
2. Wait ~5s for `get-product-by-barcode` → `resolve-barcode` fallback chain in `src/lib/scannerLookup.ts` lines 50–113.

### Expected UI
- "We're gathering evidence for this product's brand" message (VERIFIED string in `scannerLookup.ts` line 110).
- `RequestCoverageCTA` visible (INFERRED — depends on whether `ScanResultV1` mounts the CTA on the `notFound` branch; verify by reading the page).

### Expected DB writes
```sql
-- unknown_barcodes row (VERIFIED RPC call in scannerLookup.ts line 100)
SELECT barcode, user_agent, created_at
FROM unknown_barcodes
WHERE barcode = '0000000000999'
ORDER BY created_at DESC LIMIT 1;
```
Pass criteria: exactly one new row with your barcode and a populated `user_agent`. NO `user_scans` row (lookup failed before logging — VERIFIED in code flow).

---

## SECTION 5 — User Scan Logging Test

Already covered in Sections 1 & 2. Explicit standalone test:

### Steps
1. Logged in.
2. Go to `/scan` → **Enter barcode instead** → type `0024600010979` (Morton — VERIFIED strong) → **Look up**. Direct navigation to `/scan-result/...` will NOT trigger the insert because the write path lives in `Scan.tsx` → `lookupScanAndLog`, not in `ScanResultV1.tsx`.
3. Within 1 minute, run:
```sql
SELECT id, user_id, barcode, brand_id, scanned_at
FROM user_scans
WHERE barcode = '0024600010979' AND scanned_at > now() - interval '5 minutes'
ORDER BY scanned_at DESC;
```

### Pass criteria
Row returned with all 4 columns populated. `user_id` matches your authenticated user.

### If empty
Run all three diagnostics:
```sql
-- 1. Did the lookup even fire? Check edge function logs for get-product-by-barcode in last 5min.
-- 2. RLS check:
SELECT polname, polcmd, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
FROM pg_policy WHERE polrelid = 'public.user_scans'::regclass;
-- 3. Manual insert test (as authenticated user via PostgREST):
--    POST /rest/v1/user_scans with {barcode, brand_id, scanned_at} — should return 201.
```

---

## SECTION 6 — Score Function / Batch Log Test (VERIFIED via live edge logs)

### Old error signature (must NOT appear)
```
Requested function was not found
calculate-brand-score
404
```

### New expected signature (VERIFIED present in live `batch-process-brands` logs at timestamp 1776638204084):
```
[Batch Processor] Skipping per-brand score call for <BrandName> (handled by nightly recompute-brand-scores).
```

### Verification
Run in Supabase Edge Function logs UI for `batch-process-brands`, filter for last 1 hour:
- Expect: ≥1 occurrence of `Skipping per-brand score call`
- Expect: 0 occurrences of `calculate-brand-score` or `404`
- Expect final line: `[Batch Processor] Complete - N succeeded, 0 failed` (VERIFIED at timestamp 1776638206085)

---

## SECTION 7 — Category Coverage Test

### Backfilled active strong brands (VERIFIED via live SQL — all 4 active strong brands have `category_slug='food-beverages'`):
- Morton (score 43, 18 events)
- Sunshine (score 46, 19 events)
- READY (score 46, 31 events)
- Trident (score 46, 13 events)

```sql
SELECT b.id, b.name, b.category_slug, bs.score,
  (SELECT COUNT(*) FROM brand_events WHERE brand_id=b.id) AS events
FROM brands b LEFT JOIN brand_scores bs ON bs.brand_id=b.id
WHERE b.status='active' AND (bs.score<47 OR bs.score>53)
  AND (SELECT COUNT(*) FROM brand_events WHERE brand_id=b.id) >= 5
ORDER BY b.name;
```

### UI test
1. Navigate to `/search` (VERIFIED route exists in App.tsx).
2. Apply category filter `food-beverages`.
3. Expect: Morton, Sunshine, READY all appear in results.

Pass criteria: all 4 brands listed; none missing.

---

## Verification Provenance Summary

| Item | Status |
|---|---|
| Strong-brand counts (73/4/4) | VERIFIED (live SQL) |
| Routes `/scan-result/:barcode`, `/unknown/:barcode`, `/scan` | VERIFIED (App.tsx 187–228) |
| Strong barcodes S1–S3 | VERIFIED (live SQL) |
| Weak barcodes W1–W3 | VERIFIED (live SQL) |
| Unknown barcode `0000000000999` absence | VERIFIED (live SQL) |
| `user_scans` insert path | VERIFIED (scannerLookup.ts 116–128) |
| `unknown_barcodes` RPC path | VERIFIED (scannerLookup.ts 100) |
| `coverage_requests` table + toast | VERIFIED (migration + RequestCoverageCTA.tsx) |
| `brand_enrichment_queue` bump on coverage request | INFERRED (claimed in summary; not re-read here) |
| `RequestCoverageCTA` rendering on baseline branch in ScanResultV1 | INFERRED (claimed in summary; not re-read here) |
| `RequestCoverageCTA` rendering on notFound branch | NOT VERIFIED |
| Batch processor 404 fix | VERIFIED (live edge logs at 1776638204084 / 1776638206085) |
| Category backfill (food-beverages, 4 active brands) | VERIFIED (live SQL) |
