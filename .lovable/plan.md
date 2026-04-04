

# Build Product Hunt Launch Page at /launch

## Overview
Create a standalone, polished marketing page at `/launch` with no app chrome, no auth, and no bottom nav. Uses the existing dark design system but with warmer, more consumer-friendly styling (rounded-xl/2xl cards, gradient accents, no forensic styling).

## Route Setup
**File: `src/App.tsx`**
- Add lazy import for Launch page
- Add `/launch` route as a public route (no ProtectedRoute wrapper, no Header)
- Update `HeaderWrapper` to hide header on `/launch`

## New Files

### `src/pages/Launch.tsx`
- Composes all launch section components in order
- Full-page layout with `max-w-5xl mx-auto`, no app shell
- Smooth scroll behavior for anchor links

### `src/components/launch/LaunchHero.tsx`
- Headline: "Shop with your values, not just your eyes"
- Subheadline about scanning, ownership, red flags, alternatives
- Primary CTA button → `/auth`, secondary → smooth scroll to how-it-works
- Phone mockup frame (CSS bezel + notch) containing `ScannerIdleAnimation`
- Social proof placeholder line
- Fade-up motion on load

### `src/components/launch/LaunchHowItWorks.tsx`
- 3-step horizontal (desktop) / vertical (mobile) layout
- Scan → We Check → You Decide with icons and short descriptions
- Config-driven data array for easy editing

### `src/components/launch/LaunchScreenshots.tsx`
- 6-card responsive grid (2 cols mobile, 3 desktop)
- Each card: gradient placeholder area + title + caption
- Gradient backgrounds styled to look premium until real screenshots replace them
- Staggered fade-in on scroll

### `src/components/launch/LaunchJourney.tsx`
- 4-stage horizontal timeline: Scan → Verdict → Ownership → Alternative
- Connected by a line on desktop, vertical on mobile
- Icon + title + one-liner per stage

### `src/components/launch/LaunchDifferent.tsx`
- 4 cards in a 2x2 grid
- Beyond ingredients / Follow the money / Real trust scores / Better alternatives instantly
- Icon + title + 2-line description per card

### `src/components/launch/LaunchAudience.tsx`
- 4 audience cards: Conscious shoppers, Parents, Brand-skeptics, Alternative seekers
- Short description per audience

### `src/components/launch/LaunchFAQ.tsx`
- Uses existing `Accordion` component
- 6 FAQs with drafted answers
- Clean, quiet styling

### `src/components/launch/LaunchCTA.tsx`
- "Start shopping smarter" headline
- Supporting line + CTA button
- Optional email input placeholder for waitlist feel

### `src/components/launch/LaunchFooter.tsx`
- Minimal: Privacy, Terms, Methodology links
- "Built with purpose" tagline
- Copyright line

## Design Decisions
- Override the app's sharp `--radius: 0.125rem` with explicit `rounded-xl` / `rounded-2xl` on launch cards
- Use `framer-motion` (already installed) for fade-up animations with `whileInView`
- All repeated content (steps, cards, FAQs) driven by arrays for easy copy editing
- No new dependencies needed
- No database or backend changes

## Implementation Order
1. Create all 9 launch component files
2. Create `Launch.tsx` page composing them
3. Update `App.tsx` with route and header exclusion

