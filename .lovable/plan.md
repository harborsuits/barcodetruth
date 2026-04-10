

# Upgrade Homepage: Show Real Results, Not Promises

## What We're Doing

Adding three new components to the existing homepage (between existing sections). Nothing gets removed or redesigned.

## New Components

### 1. `LiveScanDemo` — placed between HeroSection and HowItWorks

A curated "See it in action" section showing 2-3 real brand results using your actual `TrustVerdict` component in a compact preview mode. Uses hardcoded brand IDs for brands with differentiated scores (not baseline-50). Each card shows:
- Brand name + logo (via `useBrandLogo`)  
- `TrustVerdict` rendered in compact form (score, verdict label, top 1 reason)
- Click navigates to `/brand/{slug}`

Data source: fetches real `brand_scores` + `brands` rows for 3 curated brand IDs at render time. No fake data.

### 2. `TryItSearch` — placed below HowItWorks (before TrendingPreview)

Three tappable pill buttons with real brand names (e.g., "Nestlé", "Coca-Cola", "Nike"). Tapping one navigates to `/search?q={name}`. Simple, no new logic — just `navigate()`. Gives instant "try it" interactivity without building anything.

### 3. `PersonalizationTeaser` — placed below TryItSearch

Shows the four value dimensions as toggle chips (Labor, Environment, Politics, Social). On toggle, a single demo brand's score visibly shifts using `computePersonalizedScore` from `@/lib/personalizedScoring` with the toggled weights. Text: "Two people. Same product. Different scores." with a CTA to sign up or go to settings.

## Updated Home.tsx Discover tab

```text
<HeroSection />
<LiveScanDemo />        ← NEW
<HowItWorks />
<TryItSearch />         ← NEW  
<PersonalizationTeaser /> ← NEW
<TrendingPreview />
<AttributionFooter />
```

## Enhancing TrendingPreview (existing component)

Add one line of context per brand — the top reason from `buildReasons()` logic (e.g., "3 labor issues on record"). This uses data already available in `brand_trending` view. No new queries.

## Files

| File | Action |
|------|--------|
| `src/components/landing/LiveScanDemo.tsx` | New — curated real scan results |
| `src/components/landing/TryItSearch.tsx` | New — tappable brand pills |
| `src/components/landing/PersonalizationTeaser.tsx` | New — interactive value weight demo |
| `src/components/landing/TrendingPreview.tsx` | Edit — add top reason line per brand |
| `src/pages/Home.tsx` | Edit — add 3 new components to Discover tab |

No backend changes. No database changes. No modifications to existing components other than TrendingPreview getting one extra line of text per item.

