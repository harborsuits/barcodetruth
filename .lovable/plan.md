

# MVP Redesign: Barcode Truth

## What We're Doing
Simplifying the app from an "intelligence dashboard" into a clean consumer product. Nothing gets deleted — we're reshaping the UI to focus on the core promise: **"Scan a product, instantly see who owns it, the biggest red flags, and better alternatives."**

## Changes Overview

### 1. Home Page — Clean Consumer Landing
**Current state:** Hero animation + search/scan + QuickDemo + TrendingPreview + RecentVerifications + HowItWorks + TrustedSources + SubscriptionBanner + AttributionFooter. Too much content, forensic language, feels like a dashboard.

**New structure:**
- **Hero**: Keep scanner animation. Simplify tagline to consumer language. Single primary CTA: "Scan a Product". Secondary: "See an Example". Remove the dual search+scan button split — make Scan dominant, search secondary.
- **How It Works**: Rewrite 3 steps with consumer language. "Scan" → "We check" → "You decide". Remove "FORENSIC PROCESS", "AUDIT", "Personal Alignment" labels.
- **Example Result**: Replace the QuickDemo (fake data, confusing) with a single "View Example Result" button linking to a real pre-seeded brand (e.g., Kraft or a well-scored brand). Simple card preview, not a multi-tab selector.
- **Trending**: Keep but simplify. Remove "TRENDING INVESTIGATIONS" → "Popular Brands". Remove "TRUST_SCORE" label. Clean card design.
- **Remove**: RecentVerifications (too noisy for landing), TrustedSources (secondary info, move to Settings/About), QuickDemo component.
- **My Scans tab**: Keep as-is, already functional.

**Files:** `src/pages/Home.tsx`, `src/components/landing/HeroSection.tsx`, `src/components/landing/HowItWorks.tsx`, `src/components/landing/TrendingPreview.tsx`. Remove imports for QuickDemo, RecentVerifications, TrustedSources from Home.

### 2. Scan Result Page — Decision-Focused
**Current state:** Product layer + TrustVerdict (score/100 + reasons) + OwnershipReveal + ScoreBreakdownCard (4 dimensions) + AlternativesSection + ShareCard + "View Full Company Profile" link. Dense, lots of sections.

**New structure:**
- **Product card** (keep): product name, brand, category, logo. Clean.
- **Simple rating badge**: Replace the complex TrustVerdict (score/100 + label) with a single clear badge: **Good** (green, 65+) / **Mixed** (yellow, 40-64) / **Avoid** (red, <40) / **Checking...** (gray, null). Large, centered, unmistakable. Still show the numeric score but smaller/secondary.
- **Top 3 reasons**: Keep, but clean up presentation. Simple bullet list, no forensic labels.
- **Ownership**: Keep the "Owned by" card. Simple and clear.
- **Better Alternatives**: Move UP — directly after reasons. This is the action item users want.
- **Evidence/Details**: Collapse ScoreBreakdownCard into an expandable "See detailed breakdown" section using Collapsible. Not hidden, but not primary.
- **Share/Save**: Keep, clean up.
- **Remove**: "View Full Company Profile" button (most users don't need this). Keep link but make it subtle text, not a prominent button.

**Files:** `src/pages/ScanResultV1.tsx`, `src/components/scan/TrustVerdict.tsx`

### 3. Brand Profile Page — Ownership-Led
**Current state:** Logo + name + verdict box + ownership + corporate tree + score breakdown + alternatives + evidence list + description. Very long, data-dense.

**New structure:**
- **Header**: Logo, name, website link. Clean.
- **Rating + Verdict**: Same simplified badge as scan result (Good/Mixed/Avoid).
- **Top concerns**: 3 reasons, same as scan result.
- **Ownership**: Keep prominent.
- **Alternatives**: Move UP, before evidence.
- **Evidence**: Keep but behind expandable "View evidence" section.
- **Score breakdown**: Move into expandable section with evidence.
- **Corporate Family Tree**: Keep but lower priority.

**Files:** `src/pages/BrandProfileV1.tsx`

### 4. Global Design Cleanup
- Replace all `label-forensic`, `font-mono text-[10px] uppercase tracking-widest` forensic styling on consumer-facing labels with clean `text-xs text-muted-foreground font-medium uppercase tracking-wide`.
- Replace "TRUST_SCORE", "SOURCE_DATA", "LOAD FULL AUDIT TRAIL" with human language: "Score", "Source", "View all evidence".
- Bottom nav: Keep simple. Scan / Search / Trending / Settings. Already mostly fine.
- Remove `forensic-grid` background class from pages (or make it very subtle).

**Files:** Multiple components touched above.

### 5. Terminology Pass
| Old | New |
|-----|-----|
| Forensic Analysis | How we check |
| AUDIT | We verify |
| Personal Alignment | Your match |
| TRENDING INVESTIGATIONS | Popular Brands |
| SOURCE_DATA | Source |
| LOAD FULL AUDIT TRAIL | View all evidence |
| Trust / Caution / Avoid | Good / Mixed / Avoid |
| label-forensic headers | Clean muted labels |
| "View Full Company Profile" | "More about this company" |

## What We're NOT Changing
- Backend, data pipeline, edge functions — untouched
- MyScansTab — already works
- Auth flow — already cleaned up
- Routing structure — same pages, same URLs
- AlternativesSection component internals — just reordered on page
- Admin pages — untouched

## Implementation Order
1. Home page simplification (biggest visual impact)
2. Scan result page cleanup (core product screen)
3. Brand profile page cleanup
4. Global terminology/styling pass

## Technical Notes
- Using existing `Collapsible` component from `@/components/ui/collapsible` for expandable evidence sections
- No new dependencies needed
- No database changes
- No edge function changes

