

# Wire Personalized Scoring into Scan Result Page

## What Changes

The scan result page currently displays the raw `brand_scores.score` from the database. The personalized scoring hook (`usePersonalizedBrandScore`) and user preference infrastructure already exist but aren't connected. This plan plugs them together so two users scanning the same product see different scores based on their values.

## Implementation

### 1. Add auth + personalized score hooks to `ScanResultV1.tsx`

- Import `usePersonalizedBrandScore` from `@/hooks/usePersonalizedBrandScore`
- Get the current user via `supabase.auth.getUser()` (or a shared auth hook if one exists)
- Call `usePersonalizedBrandScore(brandInfo?.id, user?.id)` alongside the existing `scoreData` query
- When the personalized result is available, use its `personalScore` and per-category scores instead of the raw `brand_scores` values
- Fall back to the existing `scoreData` for logged-out users or if personalization data is missing

### 2. Overlay personalized scores onto the existing score variables

Replace the score derivation block (lines ~295-330) with logic that:
- If personalized result exists: use `personalizedResult.personalScore` as `overallScore`, and `personalizedResult.categoryScores` for the four dimensions
- If not: keep current `scoreData` behavior (no regression for anonymous users)
- The existing baseline/insufficient-evidence gates remain — they still suppress scores with < 5 events

### 3. Show a "Personalized for you" indicator

- Add a small badge or text near the score when personalization is active (e.g., "Based on your values" with a link to `/settings`)
- When not logged in, show nothing (or a subtle "Sign in to personalize" nudge)

### 4. Surface top score drivers from the personalized result

The `ScoringResult` object includes `topPositive` and `topNegative` contributions. Pass these into the `WhyThisScore` component or display them inline so users understand *why* their personal score differs from the default.

## Files Changed

| File | Action |
|------|--------|
| `src/pages/ScanResultV1.tsx` | Add personalized score hook, conditional score overlay, personalization badge |

No new files. No backend changes. No database changes.

## What the User Sees After This

- **Logged in with preferences set**: Score reflects their value weights. A "Based on your values" label appears. Category breakdowns shift based on what they care about.
- **Logged in, no preferences**: Falls back to equal-weight default (same as current behavior).
- **Not logged in**: Exact same experience as today. No regression.

