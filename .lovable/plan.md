

# Fix Brand Logos, Layout Consistency & "View Again" — Implementation Plan

## Overview
Three fixes across five files. No database changes needed.

---

## Fix 1: Wikimedia Thumb URL Normalization

**File:** `src/hooks/useBrandLogo.ts` — lines 11-18

Replace the thumb handler that blindly takes `parts[parts.length - 1]` (grabs resolution variants like `200px-Logo.svg.png`) with logic that filters out 1-2 char hash dirs and `/^\d+px-/` resolution segments to find the real filename.

---

## Fix 2: "View Again" Navigation

**File:** `src/components/MyScansTab.tsx`

- **Line 15:** Add `upsertStoredScan` to the import from `@/lib/recentScans`
- **After line 104:** Add `upsertStoredScan(resolvedScan);` to persist enriched data
- **Line 106:** Change `brand?.id && (brand.status === "ready" || brand.status === "active")` → `brand?.id`

---

## Fix 3: Unify Brand Headers

Replace local `BrandLogo` functions and inline headers with the shared `BrandIdentityHeader` component in three files.

### `src/pages/BrandProfileV1.tsx`
- **Line 15:** Replace `useBrandLogo` import → `import { BrandIdentityHeader } from '@/components/brand/BrandIdentityHeader';`
- **Lines 31-59:** Delete local `BrandLogo` function
- **Lines 635-662:** Replace inline brand identity block with:
  ```tsx
  <BrandIdentityHeader brandName={brand.name} logoUrl={brand.logo_url} website={brand.website} />
  ```

### `src/components/brand/BuildingProfile.tsx`
- **Line 23:** Replace `useBrandLogo` import → `import { BrandIdentityHeader } from '@/components/brand/BrandIdentityHeader';`
- **Lines 44-71:** Delete local `BrandLogo` function
- **Lines 141-157:** Replace with:
  ```tsx
  <BrandIdentityHeader
    brandName={brand.name}
    logoUrl={brand.logo_url}
    website={brand.website}
    badge={<Badge variant="outline" className="text-xs"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Building</Badge>}
  />
  ```

### `src/components/brand/NeedsReviewProfile.tsx`
- **Line 21:** Replace `useBrandLogo` import → `import { BrandIdentityHeader } from '@/components/brand/BrandIdentityHeader';`
- **Lines 40-68:** Delete local `BrandLogo` function
- **Line 123:** Change `max-w-2xl` → `max-w-md`
- **Lines 139-154:** Replace with:
  ```tsx
  <BrandIdentityHeader
    brandName={brand.name}
    logoUrl={brand.logo_url}
    website={brand.website}
    badge={<Badge variant="outline" className="text-xs border-destructive/50 text-destructive"><HelpCircle className="h-3 w-3 mr-1" />Unverified</Badge>}
    subtitle="Description withheld pending verification"
  />
  ```
  Keep the wrapping `<div className="flex items-start gap-4">` removed — `BrandIdentityHeader` already has its own flex layout.

---

## Import Cleanup Notes
- Keep `ExternalLink` in all three profile files (used elsewhere: BrandProfileV1 line 293+, BuildingProfile line 227+, NeedsReviewProfile line 179+)
- Keep `HelpCircle` in NeedsReviewProfile (used in badge)
- Keep `Loader2` in BuildingProfile (used in badge)

## Implementation Order
1. `useBrandLogo.ts` — fix thumb handler
2. `MyScansTab.tsx` — add upsert + remove status gate
3. `BrandProfileV1.tsx` — swap header
4. `BuildingProfile.tsx` — swap header
5. `NeedsReviewProfile.tsx` — swap header + fix width

