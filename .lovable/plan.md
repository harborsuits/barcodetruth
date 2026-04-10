

# Wire Community Layer + Upgrade Personalization Prompts

## Changes

### 1. `src/components/brand/CommunityOutlookCard.tsx` — Add empty-state guard

After the existing loading skeleton (line ~157), before the main card render: if `outlook` has no categories or all categories have `n === 0`, return a friendly "Be the first to rate this brand" card.

### 2. `src/pages/ScanResultV1.tsx` — Two insertions

**A. Upgrade personalization prompt (lines 575-595)**

Replace the current subtle link/badge with a `min-h-[60px]` wrapper containing three states:
- Logged out: muted card with "This score is generic. Sign in to personalize →"
- Logged in, no preferences: "Personalize your score in 10 seconds. Set your values →"
- Logged in + personalized: existing "Based on your values" badge (kept as-is)

**B. Community block (after line 638, after AlternativesSection)**

Insert new block with:
- `CommunityOutlookCard` (with safe props: `brandInfo?.id`, fallback brand name)
- "Rate this brand" button opening `RateBrandModal`
- "Community opinions evolve over time" caption
- New `showRateModal` state + `RateBrandModal` render

### 3. `src/pages/BrandProfileV1.tsx` — One insertion

**After AlternativesSection (line 687), before details collapsible (line 689)**

Same community block pattern:
- `CommunityOutlookCard` with `resolvedBrandId` and `brand.name`
- "Rate this brand" button + `RateBrandModal`
- Caption text
- New `showRateModal` state

### Files

| File | Action |
|------|--------|
| `src/components/brand/CommunityOutlookCard.tsx` | Add empty-state guard before main render |
| `src/pages/ScanResultV1.tsx` | Import community components, upgrade personalization prompt, add community block after Alternatives |
| `src/pages/BrandProfileV1.tsx` | Import community components, add community block after Alternatives |

No database changes. No new components.

