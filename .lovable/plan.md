# User Preferences to Brand Score Correlation System

## Problem Statement

The current codebase has **multiple disconnected scoring systems** that produce different results:

1. `personalizedScoring.ts` - Event-based scoring with tanh transform
2. `calculateMatch.ts` - Gap-based matching with severity ratings  
3. `valueFit.ts` - Simple weighted average
4. `personalized_brand_score` RPC - Database-side weighted average

This creates user confusion where the same brand shows different alignment percentages depending on which code path is used.

---

## Core Concept: Preference-Matching, Not Rating

The system is NOT telling users "this brand is good/bad." It tells users:

> "Given YOUR priorities, this brand aligns at X%, with this evidence."

This is legally and ethically distinct from a verdict.

---

## The Unified Scoring Model

### Step 1: User Preferences Structure

```typescript
interface UserPreferences {
  // Dimension weights (0-100 scale, normalized to 0-1 internally)
  labor: number;           // How much user cares about labor practices
  environment: number;     // How much user cares about environment
  politics: number;        // How much user cares about political activity
  social: number;          // How much user cares about DEI/social issues
  
  // Two-axis politics (when enabled)
  political_intensity: number;   // 0=avoid political brands, 100=prefer active brands
  political_alignment: number;   // 0=progressive, 50=neutral, 100=conservative
  
  // Hard stops (optional)
  dealbreakers?: {
    labor_min?: number;      // Brand must score above this or fail
    environment_min?: number;
    politics_min?: number;
    social_min?: number;
  };
}
```

### Step 2: Brand Dimension Scores

```typescript
interface BrandDimensionScores {
  // Each dimension is 0-100 where:
  // 0 = worst possible track record
  // 50 = neutral/unknown/average
  // 100 = best possible track record
  score_labor: number;
  score_environment: number;
  score_politics: number;
  score_social: number;
  
  // Two-axis politics (when available)
  politics_intensity?: number;   // How politically active (0-100)
  politics_alignment?: number;   // 0=progressive, 100=conservative
  
  // Confidence per dimension
  confidence?: {
    labor: 'low' | 'medium' | 'high';
    environment: 'low' | 'medium' | 'high';
    politics: 'low' | 'medium' | 'high';
    social: 'low' | 'medium' | 'high';
  };
}
```

### Step 3: The Calculation (Plain English)

```
For each dimension:
1. If dimension has no evidence -> exclude from calculation (don't penalize)
2. Normalize user weights to sum to 1.0
3. Multiply: dimension_score * normalized_weight
4. Apply confidence penalty: low=0.85, medium=0.95, high=1.0
5. Sum all weighted scores
6. Check dealbreakers: if any dimension < user's minimum -> mark as failed

Result:
- alignment_score: 0-100 percentage
- confidence_level: 'early' | 'growing' | 'strong'
- top_drivers: which dimensions helped/hurt most
- dealbreaker_triggered: boolean
```

---

## Implementation Plan

### Phase 1: Consolidate to Single Scoring Function

**File: `src/lib/alignmentScore.ts` (new file)**

Create one canonical scoring function that replaces all others:

```typescript
export interface AlignmentResult {
  score: number;                    // 0-100 alignment percentage
  confidence: 'early' | 'growing' | 'strong';
  drivers: {
    category: string;
    impact: 'positive' | 'negative' | 'neutral';
    contribution: number;
    weight: number;
  }[];
  dealbreaker: {
    triggered: boolean;
    category?: string;
    threshold?: number;
    actual?: number;
  };
  excludedDimensions: string[];     // Dimensions with insufficient evidence
}

export function calculateAlignment(
  userPrefs: UserPreferences,
  brandScores: BrandDimensionScores,
  brandConfidence?: BrandConfidence
): AlignmentResult {
  // Single source of truth for all alignment calculations
}
```

### Phase 2: Update Database RPC

**Migration: Update `personalized_brand_score` RPC**

The RPC should return a JSON object, not just a number:

```sql
CREATE OR REPLACE FUNCTION personalized_brand_score_v2(
  p_brand_id uuid,
  p_user_id uuid
) RETURNS jsonb AS $$
  -- Returns:
  -- {
  --   "score": 72,
  --   "confidence": "growing",
  --   "drivers": [...],
  --   "dealbreaker": { "triggered": false }
  -- }
$$
```

### Phase 3: Update UI Components

**Files to update:**

1. `src/components/brand/PersonalizedScoreCard.tsx`
   - Show confidence level prominently
   - Show top drivers (why this score)
   - Show dealbreaker warnings

2. `src/components/brand/PersonalizedScoreDisplay.tsx`
   - Visual representation of alignment
   - Color coding: green (70+), amber (40-69), red (<40)
   - Dimension breakdown bars

3. `src/components/brand/ScoresGrid.tsx`
   - Add user weight indicators (which dimensions user cares about)
   - Highlight dimensions that impact alignment most

### Phase 4: Add Evidence Sufficiency Check

**File: `src/lib/evidenceSufficiency.ts` (new file)**

```typescript
// Check if brand has enough evidence across domains to justify a score
export function checkEvidenceSufficiency(brandId: string): {
  sufficient: boolean;
  coveredDomains: string[];
  missingDomains: string[];
  recommendation: 'show_score' | 'show_preview';
}
```

This integrates with the tier system already implemented.

### Phase 5: Create Explainer Component

**File: `src/components/brand/ScoreExplainer.tsx` (new file)**

Visual component that shows:
1. How user preferences map to brand scores
2. Which dimensions are pulling the score up/down
3. What evidence backs each dimension score
4. Confidence indicators per dimension

---

## Visual Flow Diagram

```
User Sets Preferences (Settings Page)
         |
         v
    [Sliders 0-100]
    - Labor: 80
    - Environment: 60  
    - Politics: 20
    - Social: 50
         |
         v
   Normalize Weights
    - Labor: 0.38
    - Environment: 0.29
    - Politics: 0.10
    - Social: 0.24
         |
         v
   User Scans/Views Brand
         |
         v
   Fetch Brand Scores
    - Labor: 45
    - Environment: 78
    - Politics: 60
    - Social: 55
         |
         v
   Calculate Alignment
    - Labor:       45 * 0.38 = 17.1
    - Environment: 78 * 0.29 = 22.6
    - Politics:    60 * 0.10 = 6.0
    - Social:      55 * 0.24 = 13.2
    - Sum = 58.9 -> 59% aligned
         |
         v
   Apply Confidence Penalty
    - Labor confidence: low (0.85)
    - Adjusted = 58.9 * ~0.93 = 55%
         |
         v
   Check Dealbreakers
    - None set -> pass
         |
         v
   Display Result
    "55% aligned with your priorities"
    "Labor practices (-) dragging score"
    "Environment (+) helping score"
```

---

## Files to Create/Modify

### New Files:
1. `src/lib/alignmentScore.ts` - Single canonical scoring function
2. `src/lib/evidenceSufficiency.ts` - Domain coverage checker
3. `src/components/brand/ScoreExplainer.tsx` - Visual explainer component
4. `src/components/brand/AlignmentBreakdown.tsx` - Dimension-by-dimension breakdown

### Files to Modify:
1. `src/hooks/usePersonalizedScore.ts` - Use new RPC, return full result object
2. `src/components/brand/PersonalizedScoreCard.tsx` - Display drivers and confidence
3. `src/components/brand/ScoresGrid.tsx` - Show which dimensions matter to user
4. `src/pages/BrandProfileV1.tsx` - Integrate new explainer

### Database Changes:
1. Update `personalized_brand_score` RPC to return JSONB with full result
2. Add `v_brand_dimension_confidence` view for per-dimension confidence

---

## Success Criteria

1. **Single Source of Truth**: All scoring uses `calculateAlignment()` function
2. **Transparency**: Users can see exactly why they got their score
3. **Confidence Visible**: Low-confidence dimensions are clearly marked
4. **Dealbreakers Work**: Hard stops prevent recommendations
5. **Evidence Requirement**: Scores only shown when evidence is sufficient
6. **Consistent Numbers**: Same brand + same preferences = same score everywhere

---

## Implementation Order

1. Create `src/lib/alignmentScore.ts` with unified calculation
2. Update RPC to use new logic and return JSONB
3. Create `ScoreExplainer.tsx` component
4. Update `PersonalizedScoreCard.tsx` to use new data
5. Deprecate old scoring files (`valueFit.ts`, `calculateMatch.ts`)
6. Add per-dimension confidence tracking
7. Integrate with tier system for evidence sufficiency