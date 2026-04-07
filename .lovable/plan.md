

# Reservoir: Adaptive Intelligence Layer — Implementation Plan

## What Gets Built

A pattern-memory system that detects repeated behavioral signals, computes a bounded score adjustment (±5 max), and surfaces learning insights in the "Why this score?" UI. Core scoring math is untouched.

```text
[existing engine] → base_score
                        │
   reservoir_signals → adjustment (±5 max, grouped ±2 per type)
                        │
                  final_score = clamp(base + adj, 0, 100)
```

Fallback: no signals or query failure → adjustment = 0. Zero regression risk.

---

## Phase 1: Database Migration

**Two new tables:**

- **`reservoir_signals`** — pattern storage: `signal_type` (recall_pattern / violation_pattern / certification_signal), `brand_id` (nullable), `category` (nullable for category-wide patterns), `dimension`, `weight` (float, starts 1.0), `confidence` (float), `evidence_count`, `last_seen`, `created_at`
- **`reservoir_adjustments`** — audit trail: `brand_id`, `adjustment` (float), `signals_used` (jsonb), `computed_at`

RLS: service role writes, authenticated reads.

---

## Phase 2: Edge Function — `update-reservoir`

**New file:** `supabase/functions/update-reservoir/index.ts`

Runs daily via pg_cron. For each brand with ≥3 score-eligible events:

1. **Recall patterns** — count events with recall/safety keywords in title → if ≥3, upsert signal
2. **Violation patterns** — count OSHA/EPA penalty events → if ≥3, upsert signal
3. **Certifications** — detect B-Corp, Fair Trade, organic keywords → upsert positive signal

**Weight formula** (with all requested refinements):
```
recency_factor = e^(-days_since_last_seen / 180)
weight = min(1.0, evidence_count * 0.15 * recency_factor)
confidence = min(1.0, ln(1 + corroborated_count))
```

**Safeguards built in:**
- Daily decay: `weight *= 0.99`, delete where `< 0.01`
- Max 5 signals per type per brand (prevents large-brand stacking)
- Category signals require `evidence_count >= 5`
- Brands with `< 3` total events skipped entirely

---

## Phase 3: Integrate into `recompute-brand-scores`

**File:** `supabase/functions/recompute-brand-scores/index.ts`

After line ~472 (where `overallScore` is computed), add ~25 lines:

1. Batch-fetch `reservoir_signals` for brand IDs being scored (+ category-level signals via `.or()`)
2. Group by `signal_type`, take top 5 per group
3. Per group: `group_adj = clamp(sum(w * conf * modifier), -2, 2)` where modifier = +1.5 certification, -1.5 negative
4. Noise floor: skip signals where `weight * confidence < 0.1`
5. Total: `adjustment = clamp(sum_of_groups, -5, 5)`
6. Apply: `overallScore = clamp(overallScore + adjustment, 0, 100)`
7. Log to `reservoir_adjustments`

---

## Phase 4: UI — "Learning Signals" in WhyThisScore

**File:** `src/components/scan/WhyThisScore.tsx`

Add a query for `reservoir_adjustments` (latest for this brand). If adjustment was applied, insert a new section between "Data confidence" and "Integrity note":

- Header: "🧠 Learning signals" with Brain icon
- Bullets like: "System detected repeated recall patterns" / "Certified sustainability credentials recognized"
- Show adjustment magnitude: "Score adjusted by −2 based on behavioral patterns"

---

## Phase 5: pg_cron Schedule

Schedule `update-reservoir` daily at 3 AM UTC (after the existing 6-hourly recompute cycle). Use insert tool (not migration) since it contains project-specific URLs/keys.

---

## Files Changed

| File | Action |
|------|--------|
| SQL migration | Create 2 tables + RLS |
| `supabase/functions/update-reservoir/index.ts` | New (~150 lines) |
| `supabase/functions/recompute-brand-scores/index.ts` | Add ~25 lines after line 472 |
| `src/components/scan/WhyThisScore.tsx` | Add learning signals section (~30 lines) |
| pg_cron (via insert tool) | Schedule daily run |

## Safety Summary

- ±5 total cap, ±2 per signal type
- Max 5 signals per type (stacking prevention)
- Noise floor: `w * conf < 0.1` → skip
- Category signals need ≥5 evidence
- Brands need ≥3 events to generate signals
- Certification modifier: +1.5 (not +2, keeps balance)
- Daily 1% decay, auto-cleanup at 0.01
- Graceful degradation: failure = adjustment 0
- Full audit trail in `reservoir_adjustments`

