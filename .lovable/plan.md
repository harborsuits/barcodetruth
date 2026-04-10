

# Brand-First Search + Product Deduplication

## What We're Doing

Upgrading `Search.tsx` so search feels like an answer engine, not a database browser. No new pages, no backend changes.

## Changes (all in `src/pages/Search.tsx`)

### 1. Reorder tabs: Brands first
Change tab order to **Brands | Products | Companies**. Auto-select "brands" tab when brand results exist (unless URL already specifies a tab).

### 2. Featured brand card (above tabs)
When exactly ONE brand result exists, render a prominent card above the tabs showing:
- Brand name + score + verdict badge (Good/Mixed/Avoid)
- Top reason (e.g., "3 labor violations")
- "View full breakdown" link to `/brand/{id}`

Score fetched from `brand_scores` after search completes. Skeleton state while loading.

### 3. Product deduplication in Products tab
Group products client-side by normalized name + brand_id:
```text
normalize = lowercase, strip non-alphanumeric
group key = normalize(name) + brand_id
```
Each group renders one card: "Coca-Cola — Soft drinks — 12 sizes & packages". Click navigates to first barcode's scan result.

### 4. Inline score badges on brand results
After search results arrive, one query fetches scores for all returned brand IDs. Small colored badge (Good/Mixed/Avoid) on each brand card, skeleton while loading.

### 5. Verdict logic
Reuse same thresholds from `LiveScanDemo.tsx`: 65+ Good, 40+ Mixed, below Avoid.

## Files

| File | Action |
|------|--------|
| `src/pages/Search.tsx` | Reorder tabs, add featured card, group products, fetch + show brand scores inline |

No database changes. No new components needed.

