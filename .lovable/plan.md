

# Barcode Truth — Full Execution Plan (Amended)

## Key Discovery

The `brands` table has TWO relevant fields:
- `is_active` (boolean) — currently `true` for ALL 1,396 brands (useless as a gate)
- `status` (text) — values are `'stub'` (919) and `'ready'` (477). **No brands have `status = 'active'` yet.**

The `brand_trending` view already filters `WHERE b.is_active = true`, but since all brands are `is_active = true`, this gate does nothing. The real gate must use `status = 'active'`.

**43 brands** qualify for promotion (≥5 non-irrelevant events + description exists).

---

## Phase 1 — Gate the Public Catalog

### 1.1 Promote launch cohort (do this FIRST so gates have data to show)
**Type:** Data operation (insert tool)

```sql
UPDATE brands SET status = 'active'
WHERE id IN (
  SELECT b.id FROM brands b
  JOIN (
    SELECT brand_id, COUNT(*) AS cnt
    FROM brand_events WHERE is_irrelevant = false
    GROUP BY brand_id HAVING COUNT(*) >= 5
  ) e ON b.id = e.brand_id
  WHERE b.description IS NOT NULL AND b.description != ''
);
```

### 1.2 Gate `search_catalog` RPC
**Type:** DB migration

Recreate the function adding `AND status = 'active'` to the `brand_matches` CTE:
```sql
WHERE ... AND b.status = 'active'
```

### 1.3 Gate `search-brands` edge function
**File:** `supabase/functions/search-brands/index.ts`

- Exact/prefix query (line 112-116): Add `.eq('status', 'active')`
- Alias results: Add `status` to the brand select in the alias join, then filter: `aliasResults.filter(r => r.brands?.status === 'active')`
- Fuzzy results: Post-filter `fuzzyResults.filter(r => r.status === 'active')` (simpler than modifying the RPC)

### 1.4 Gate `brand_trending` view
**Type:** DB migration

Recreate the view replacing `WHERE b.is_active = true` with `WHERE b.status = 'active'` (or add both conditions).

### 1.5 Gate `TrendingPreview.tsx`
**File:** `src/components/landing/TrendingPreview.tsx`

The view change (1.4) handles the live-data path. For the snapshot path, no change needed (snapshots are pre-filtered at publish time).

### 1.6 Gate `RecentVerifications.tsx`
**File:** `src/components/landing/RecentVerifications.tsx`

Add `status` to the brands select and filter client-side:
```ts
.select(`..., brands (id, name, logo_url, status)`)
// then filter:
data.filter(e => e.brands?.status === 'active')
```

### 1.7 Gate `v1-brands` trending endpoint
**File:** `supabase/functions/v1-brands/index.ts`

The view change (1.4) handles this automatically since `/trending` queries `brand_trending`.

---

## Phase 2 — Backfill Brand Identity

### 2.1 Resolve logos for active brands
Invoke `resolve-brand-logo` for active brands missing logos.

### 2.2 Re-enrich descriptions
Invoke `enrich-brand-wiki` for active brands with weak/missing descriptions.

---

## Phase 3 — Populate Alternatives

Invoke `precompute-alternatives` for the active brand cohort.

---

## Phase 4 — Verify Brand Profile Rendering

Already implemented: evidence cards, stacked metric rows, VIEW ALTERNATIVES, LOAD FULL AUDIT TRAIL. QA on real active brand data.

---

## Phase 5 — Theme & Visual QA

Audit the slate-teal/coral palette across Auth, Onboarding, Scan, Home, Brand Profile for contrast, hover states, and consistency.

---

## Phase 6 — Confirm Unknown Product Flow

Already idempotent. Final QA to verify no destructive toasts on duplicate submissions.

---

## Files to Change

| Change | File/System | Type |
|--------|------------|------|
| Promote 43 brands to active | SQL UPDATE | Data operation |
| Gate search_catalog | Migration (recreate RPC) | DB migration |
| Gate brand_trending view | Migration (recreate view) | DB migration |
| Gate search-brands | `supabase/functions/search-brands/index.ts` | Edge function |
| Gate recent verifications | `src/components/landing/RecentVerifications.tsx` | Frontend |
| Backfill logos | `resolve-brand-logo` invocations | Operational |
| Populate alternatives | `precompute-alternatives` invocation | Operational |
| Re-enrich descriptions | `enrich-brand-wiki` invocations | Operational |
| Theme fixes | Affected UI components (if found) | Frontend |

## Execution Order

1. Promote 43 qualifying brands to `status = 'active'`
2. Gate `search_catalog` RPC and `brand_trending` view (2 migrations)
3. Gate `search-brands` edge function
4. Gate `RecentVerifications.tsx`
5. Backfill logos + descriptions for active cohort
6. Populate alternatives
7. QA brand profiles + theme audit

