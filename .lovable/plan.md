

# Decision Engine Refactor — Loop-First Product

## What This Does
Transforms the app from a "scanner with data" into a "decision loop": **Scan → Verdict → Alternative → Next scan**. No new backend work. Pure subtraction + reframing.

## Changes

### 1. Home → Scan-First Entry Point
**File: `src/pages/Home.tsx`**

Remove the tab system, remove `LiveScanDemo`, `TryItSearch`, `PersonalizationTeaser`, `TrendingPreview`, `AttributionFooter`, `WelcomeTour`.

New layout:
- Simplified `HeroSection` (scan CTA + search bar only)
- Compact inline "How it works" row (3 icons, one line each — keep `HowItWorks` but make it smaller)
- Recent scans list (if logged in, pulled from `MyScansTab` data, shown as compact list — not a tab)

Remove bottom nav items `Trending`. Keep: **Scan**, **Search**, **Settings** (+ Admin if admin).

### 2. HeroSection → Tool, Not Marketing
**File: `src/components/landing/HeroSection.tsx`**

Remove the `ScannerIdleAnimation` box (saves 480px of viewport). Remove the staggered motion delays. Keep:
- Tagline: "Know what's behind every barcode" (one line, no animation)
- "Scan a Product" button (dominant, full-width)
- Search bar below

### 3. ScanResult → 5-Block Decision Screen
**File: `src/pages/ScanResultV1.tsx`**

**Above the fold (always visible):**
1. Product card (keep as-is)
2. `TrustVerdict` — make it the dominant element (larger score, bolder verdict text)
3. `ReasonProofList` — replace `WhyThisScore` with the shared component (max 3 reasons with proof anchors)
4. `AlternativesSection` — move UP to position 4 (currently position 6)
5. "Scan Another Product" button

**Below the fold — collapsed under "See proof & details":**
- `OwnershipReveal`
- `EvidenceSection`
- `ScoreBreakdownCard`
- `CommunityOutlookCard` + rate button
- `ShareCard`

**Remove entirely:**
- All 3 personalization banners (lines 534-567: "Based on your values", "Personalize your score", "This score is generic")
- "Who makes this?" label (line 526-530)
- Separate `WhyThisScore` component (replaced by `ReasonProofList`)

**Building state (lines 432-466):** Render the same 5-block layout. `TrustVerdict` and `ReasonProofList` already handle null scores. Always show alternatives. Never show emptiness.

### 4. Stronger Collapse Label
Replace `"See detailed breakdown"` with `"See proof & details"` — specific, trust-building language instead of generic "view details".

## Technical Details

| File | Action |
|------|--------|
| `src/pages/Home.tsx` | Strip to scan-first layout, remove tabs, remove 5 landing sections |
| `src/components/landing/HeroSection.tsx` | Remove animation box, simplify to CTA + search |
| `src/pages/ScanResultV1.tsx` | Reorder to 5-block layout, collapse secondary content, remove personalization banners, unify building state, replace WhyThisScore with ReasonProofList |
| `src/components/landing/HowItWorks.tsx` | Compact to single-row inline format |

No database changes. No new components. Backend untouched.

