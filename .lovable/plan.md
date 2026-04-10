

# Always Deliver an Answer — Kill Pipeline UI, Ship Provisional Scores

## Problem
`BuildingProfile` shows "Researching this brand", progress bars, and "Score will publish later" — exposing backend pipeline state instead of delivering answers. Users see an unfinished product and leave.

## Changes

### 1. Create `src/lib/buildReasons.ts` — Shared reason generator
Extract `buildReasons()` from `ScanResultV1.tsx` (lines 64-90) into a standalone module. Enhance it to also consider pillar scores (e.g., `labor_score < 50` → "Weak labor practices score") when event counts are zero but scores exist. Both `BuildingProfile` and `ScanResultV1` import from here. Remove the inline copy from `ScanResultV1`.

### 2. Create `src/lib/getConfidenceLabel.ts` — Confidence framing
Maps completeness percentage to user-facing labels:
- `<40%` → "Early" (muted color)
- `40-70%` → "Growing" (yellow)  
- `>70%` → "High" (green)

### 3. Rewrite `src/components/brand/BuildingProfile.tsx` — Live profile

**Add query**: Fetch `brand_scores` for this brand (same pattern as ScanResultV1 line 248-267, selecting `score, score_labor, score_environment, score_politics, score_social`).

**New layout order**:
1. **Brand Identity Header** — change badge from "Building profile" to "Live profile"
2. **Provisional Score + Confidence** — if score exists: large score number + "Preliminary · evolving" badge + confidence label from completeness. If no score but has events: "Limited data — {N} records analyzed"
3. **Top Reasons** — use shared `buildReasons()` with fetched score pillars + evidence counts. Header: "Why this score (so far)". Max 3 bullet points
4. **Stats line** — single line: "Based on {N} public records across {M} categories" (not a card, not "verified")
5. **Ownership** — keep existing `OwnershipRevealBuilding` (moved down from current position)
6. **Power & Profit** — keep
7. **Help improve actions** — keep

**Remove entirely**:
- "Researching this brand" card with Search icon (lines 64-102)
- Progress bar with "Research progress: 88%" (lines 86-100)
- "Score will publish once we verify enough sources" (line 122)
- "What we found so far" stats card (lines 104-127)

### 4. Update `src/pages/ScanResultV1.tsx` — Kill building-state pipeline UI (lines 458-514)

Replace the entire building state block. New logic:
- If `scoreData` exists (query already runs at line 248): **fall through to the ready state** instead of returning early. Add a `brandIsBuilding` flag so the ready-state UI can show a "Preliminary" note on the score.
- If no score and no brand info: show slim card with brand name + "Profile building — check back soon" + ownership + Save button (no pipeline stages, no `EnrichmentStageProgress`).

Remove `EnrichmentStageProgress` import (line 15) — no longer user-facing.

### 5. Update `src/pages/BrandProfileV1.tsx` — Fix null-score verdict (line 590)

Change: `hasEvidence ? 'Analyzing' : 'Not yet rated'`  
To: `hasEvidence ? 'Limited Data' : 'Not yet rated'`

When verdict is "Limited Data", show `"{evidenceTotal} records found"` as subtitle instead of "Score will appear once verified data is reviewed".

### 6. Update `src/components/brand/DataLimitationsNotice.tsx` — Reframe "collecting" (lines 55-59)

- Title: "Data collection in progress" → "Building a complete picture"
- Description: → "This profile is continuously updated as new public records are verified."
- Subtext: → "Coverage grows automatically over time."

## Files

| File | Action |
|------|--------|
| `src/lib/buildReasons.ts` | New — shared reason generator |
| `src/lib/getConfidenceLabel.ts` | New — confidence label helper |
| `src/components/brand/BuildingProfile.tsx` | Major rewrite — provisional score, reasons, kill pipeline UI |
| `src/pages/ScanResultV1.tsx` | Remove building-state pipeline block, fall through to ready state with preliminary flag |
| `src/pages/BrandProfileV1.tsx` | Change null-score verdict from "Analyzing" to "Limited Data" |
| `src/components/brand/DataLimitationsNotice.tsx` | Reframe "collecting" copy |

No database changes.

