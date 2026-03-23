# Pre-Launch Scoring & Data Hardening Checklist

## Status Legend
- ✅ Implemented
- 🔲 Not yet implemented

---

## Priority 1 — Tighten Score Eligibility

✅ **Score eligibility gate on `brand_events`**  
- `score_eligible` boolean column added  
- Events must pass ALL gates to affect scores:
  - Valid category (not `general`)
  - Nonzero impact in at least one dimension
  - Source tier 1 or 2 (not tier 3)
  - `category_confidence >= 0.4`
  - Not flagged as `is_irrelevant`

✅ **Scoring pipeline filters on `score_eligible`**  
- `recompute-brand-scores` skips tier-3/non-eligible events entirely
- Tier-based weight multiplier: Tier 1 = 1.0, Tier 2 = 0.6, Tier 3 = 0.1

✅ **`compute_score_eligibility()` DB function**  
- Reusable SQL function for triggers and backfills

✅ **Confidence threshold raised to 0.5** (from initial 0.4)

🔲 **Staleness gate**: Events older than 2 years should not affect scores unless tagged as historically significant

🔲 **Ambiguity gate**: Mixed-orientation events with low confidence should be feed-only

---

## Priority 2 — Formalize Source Tiers

✅ **Three-tier framework**  
- **Tier 1 (Score-driving)**: OSHA, EPA, FDA, FEC, SEC, all `.gov` domains, court records
- **Tier 2 (Corroborating)**: Reuters, AP, NYT, WSJ, Guardian, BBC, Bloomberg, CNN, NPR, etc.
- **Tier 3 (Context-only)**: Reddit, Seeking Alpha, Fool.com, PR Newswire, generic RSS, unknown domains

✅ **`source_tier` column on `brand_events`**  
- Backfilled for all existing events based on credibility scores

✅ **Shared `_shared/sourceTiers.ts`**  
- `classifySourceTier(domain)` — deterministic tier classification
- `TIER_SCORE_WEIGHTS` — scoring multipliers per tier
- `TIER_LABELS` — human-readable labels for UI
- `isScoreEligible()` — shared gate logic

✅ **`categorize-event` sets tier and eligibility**  
- Every new event gets `source_tier` and `score_eligible` on ingestion

✅ **UI tier badges on EventCard**  
- "Score-driving", "Corroborating", or "Context" badge with tooltip

🔲 **Admin tier override**: Allow admins to promote/demote individual event tiers

🔲 **Expose tier distribution in admin health dashboard**

---

## Priority 3 — Split Feed from Score Evidence

✅ **Observable vs score-eligible event distinction**  
- All events appear in feed (brand profile event timeline)
- Only `score_eligible = true` events contribute to dimension scores
- Tier 3 events are explicitly skipped in `recompute-brand-scores`

✅ **Tier badge in UI communicates which events drive scores**

🔲 **Add "Score evidence" filter toggle to event timeline UI**

🔲 **Score transparency**: In "Why this score?" narrative, only cite score-eligible events

---

## Priority 4 — Strengthen Alternative Attributes (Not Yet Implemented)

🔲 **Attribute provenance**: Every `brand_attributes` entry must have `source`, `confidence`, `last_updated`, `evidence_type`

🔲 **Explainability**: Each alternative recommendation must include reasoning:
  - "Suggested because it is independently owned"
  - "Suggested because it has verified B Corp certification"
  - "Suggested because it is headquartered in your region"

🔲 **Attribute confidence thresholds**:
  - `b_corp` → only from official B Corp directory
  - `local` → HQ in region + independent ownership, not just text match
  - `sustainable/green` → evidence-backed, not inferred from marketing copy
  - `political_left/right` → derived from transparent FEC/lobbying data only

🔲 **Attribute audit trail**: Admin view showing provenance of every attribute

---

## Priority 5 — Server-Side Canonical Personalized Scoring (Not Yet Implemented)

✅ **`personalized_brand_score_v2` RPC exists server-side**
- Already handles user weights, confidence multipliers, and dealbreakers

🔲 **Use server-side score for**:
  - Rankings and leaderboards
  - Saved lists and comparisons
  - B2B API responses
  - Alternative sorting

🔲 **Client-side scoring remains for instant UI**, but server-side is canonical for persisted outputs

🔲 **Cache invalidation**: When user preferences change, invalidate server-side cached scores

---

## Additional Hardening Items

### Politics Dimension Granularity
🔲 **Internal sub-categories** (user sees one score):
  - Donations (FEC data)
  - Lobbying (OpenSecrets/LDA data)
  - Alignment signals (public statements, endorsements)
  - Policy/legal actions (litigation, regulatory)

🔲 **Internal weighting** of sub-categories before producing visible politics score

### "Attempted None" Messaging
🔲 **Audit wording** in DimensionCoverageCard:
  - ✅ "No verified negative signal found in checked sources"
  - ✅ "Coverage complete for this dimension"
  - ❌ NOT "Verified clean" or "No issues" (implies virtue)

### Classifier Confidence
🔲 **Low-confidence events go to feed only**: If `category_confidence < 0.5`, mark as feed-context regardless of tier

🔲 **Classifier telemetry**: Track false positive rate via admin classification_audit review

---

## Implementation Status Summary

| Priority | Description | Status |
|----------|-------------|--------|
| P1 | Score eligibility gates | ✅ Shipped |
| P2 | Formalized source tiers | ✅ Shipped |
| P3 | Feed vs score evidence split | ✅ Shipped |
| P4 | Alternative attribute provenance | 🔲 Not started |
| P5 | Server-side canonical scoring | 🔲 Partial (RPC exists) |

**Core trust rule**: Official data drives scores, news explains scores, weak signals never masquerade as truth.
