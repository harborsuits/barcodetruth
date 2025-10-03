-- ================================================================
-- QA QUERY PACK: Mixed Events + Feature Flags
-- Validates implementation of mixed event scoring and feature flags
-- ================================================================

-- 1. VERIFY MIXED EVENT COUNTS BY BRAND (90d window)
-- Shows which brands have mixed events that will affect scores
SELECT 
  b.id AS brand_id,
  b.name AS brand_name,
  COUNT(CASE WHEN be.category='labor' AND be.orientation='mixed' THEN 1 END) AS labor_mixed,
  COUNT(CASE WHEN be.category='environment' AND be.orientation='mixed' THEN 1 END) AS env_mixed,
  COUNT(CASE WHEN be.category='politics' AND be.orientation='mixed' THEN 1 END) AS pol_mixed,
  COUNT(CASE WHEN be.category='social' AND be.orientation='mixed' THEN 1 END) AS social_mixed,
  COUNT(*) AS total_events_90d
FROM public.brands b
LEFT JOIN public.brand_events be 
  ON be.brand_id = b.id 
  AND be.occurred_at >= NOW() - INTERVAL '90 days'
WHERE b.id IN (
  SELECT DISTINCT brand_id 
  FROM brand_events 
  WHERE orientation='mixed' 
    AND occurred_at >= NOW() - INTERVAL '90 days'
)
GROUP BY b.id, b.name
ORDER BY (
  COUNT(CASE WHEN be.orientation='mixed' THEN 1 END)
) DESC
LIMIT 20;

-- 2. CHECK V_BASELINE_INPUTS_90D INCLUDES MIXED COLUMNS
-- Confirms the view was updated correctly
SELECT 
  brand_name,
  labor_mixed_90d,
  env_mixed_90d,
  pol_mixed_90d,
  social_mixed_90d,
  total_events_90d
FROM public.v_baseline_inputs_90d
WHERE labor_mixed_90d > 0 
   OR env_mixed_90d > 0 
   OR pol_mixed_90d > 0 
   OR social_mixed_90d > 0
LIMIT 10;

-- 3. VERIFY SCORING WEIGHTS FOR MIXED EVENTS
-- Confirms config is seeded
SELECT key, value, description
FROM public.scoring_weights
WHERE key LIKE 'window.mixed%'
ORDER BY key;

-- 4. CHECK GLOBAL FEATURE FLAGS
-- Shows current state of politics_alignment_penalty and news_tone_enabled
SELECT key, enabled, description
FROM public.scoring_switches
WHERE key IN ('politics_alignment_penalty', 'news_tone_enabled')
ORDER BY key;

-- 5. LIST BRAND-LEVEL FEATURE FLAG OVERRIDES
-- Shows which brands have news_tone_enabled (or other flags)
SELECT 
  bff.brand_id,
  b.name AS brand_name,
  bff.key,
  bff.enabled
FROM public.brand_feature_flags bff
JOIN public.brands b ON b.id = bff.brand_id
ORDER BY b.name, bff.key;

-- 6. VALIDATE BREAKDOWN INCLUDES MIXED EVENTS
-- Check that brand_scores.breakdown contains mixed event contributions
-- (Run after recalculating a brand with mixed events)
SELECT 
  b.name AS brand_name,
  bs.last_updated,
  bs.breakdown->'labor'->>'window_delta' AS labor_window_delta,
  bs.breakdown->'labor'->'window_inputs'->>'labor_mixed_90d' AS labor_mixed_count,
  bs.breakdown->'environment'->>'window_delta' AS env_window_delta,
  bs.breakdown->'environment'->'window_inputs'->>'env_mixed_90d' AS env_mixed_count,
  bs.breakdown->'politics'->>'window_delta' AS pol_window_delta,
  bs.breakdown->'politics'->'window_inputs'->>'pol_mixed_90d' AS pol_mixed_count,
  bs.breakdown->'social'->>'window_delta' AS social_window_delta,
  bs.breakdown->'social'->'window_inputs'->>'social_mixed_90d' AS social_mixed_count
FROM public.brand_scores bs
JOIN public.brands b ON b.id = bs.brand_id
WHERE 
  (bs.breakdown->'labor'->'window_inputs'->>'labor_mixed_90d')::int > 0
  OR (bs.breakdown->'environment'->'window_inputs'->>'env_mixed_90d')::int > 0
  OR (bs.breakdown->'politics'->'window_inputs'->>'pol_mixed_90d')::int > 0
  OR (bs.breakdown->'social'->'window_inputs'->>'social_mixed_90d')::int > 0
LIMIT 10;

-- 7. COMPARE SCORES BEFORE/AFTER POLITICS_ALIGNMENT_PENALTY TOGGLE
-- Snapshot current politics scores
CREATE TEMP TABLE IF NOT EXISTS politics_scores_snapshot AS
SELECT brand_id, score_politics, breakdown->'politics' AS pol_breakdown
FROM public.brand_scores;

-- After toggling the flag and recalculating, run:
-- SELECT 
--   b.name,
--   snap.score_politics AS old_score,
--   bs.score_politics AS new_score,
--   bs.score_politics - snap.score_politics AS delta
-- FROM politics_scores_snapshot snap
-- JOIN public.brand_scores bs ON bs.brand_id = snap.brand_id
-- JOIN public.brands b ON b.id = bs.brand_id
-- WHERE bs.score_politics != snap.score_politics
-- ORDER BY ABS(bs.score_politics - snap.score_politics) DESC
-- LIMIT 20;

-- 8. VERIFY REASON STRINGS INCLUDE MIXED EVENTS
-- Check that breakdown 'why' or 'reason' fields mention "mixed"
SELECT 
  b.name AS brand_name,
  bs.breakdown->'labor'->>'why' AS labor_why,
  bs.breakdown->'environment'->>'why' AS env_why,
  bs.breakdown->'politics'->>'why' AS pol_why,
  bs.breakdown->'social'->>'why' AS soc_why
FROM public.brand_scores bs
JOIN public.brands b ON b.id = bs.brand_id
WHERE 
  bs.breakdown->'labor'->>'why' LIKE '%mixed%'
  OR bs.breakdown->'environment'->>'why' LIKE '%mixed%'
  OR bs.breakdown->'politics'->>'why' LIKE '%mixed%'
  OR bs.breakdown->'social'->>'why' LIKE '%mixed%'
LIMIT 10;

-- 9. FIND A TEST BRAND WITH MIXED EVENTS (for manual edge function test)
-- Use this brand_id to call calculate-baselines and verify behavior
SELECT 
  b.id,
  b.name,
  COUNT(*) FILTER (WHERE be.orientation='mixed') AS mixed_count,
  COUNT(*) AS total_events
FROM public.brands b
JOIN public.brand_events be ON be.brand_id = b.id
WHERE be.occurred_at >= NOW() - INTERVAL '90 days'
GROUP BY b.id, b.name
HAVING COUNT(*) FILTER (WHERE be.orientation='mixed') > 0
ORDER BY mixed_count DESC
LIMIT 5;

-- 10. VALIDATE CAPPING (verify mixed contribution never exceeds -3)
-- After recalculating brands with many mixed events
SELECT 
  b.name,
  (bs.breakdown->'labor'->'window_inputs'->>'labor_mixed_90d')::int AS labor_mixed_count,
  (bs.breakdown->'labor'->>'window_delta')::numeric AS labor_window_delta,
  (bs.breakdown->'environment'->'window_inputs'->>'env_mixed_90d')::int AS env_mixed_count,
  (bs.breakdown->'environment'->>'window_delta')::numeric AS env_window_delta
FROM public.brand_scores bs
JOIN public.brands b ON b.id = bs.brand_id
WHERE 
  (bs.breakdown->'labor'->'window_inputs'->>'labor_mixed_90d')::int >= 6
  OR (bs.breakdown->'environment'->'window_inputs'->>'env_mixed_90d')::int >= 6
LIMIT 10;

-- ================================================================
-- SMOKE TEST CHECKLIST
-- ================================================================
-- [ ] Query 1: Identifies brands with mixed events in 90d window
-- [ ] Query 2: v_baseline_inputs_90d contains *_mixed_90d columns
-- [ ] Query 3: Scoring weights exist (window.mixed.pt = -0.5, cap = -3)
-- [ ] Query 4: Feature flags exist (politics_alignment_penalty=true, news_tone_enabled=false)
-- [ ] Query 5: Brand-level flags work (check brand_feature_flags table)
-- [ ] Query 6: Breakdown JSON includes mixed event counts in window_inputs
-- [ ] Query 8: Reason strings mention "mixed events" when present
-- [ ] Query 9: Found test brand IDs for manual edge function calls
-- [ ] Query 10: Window deltas respect -3 cap even with >6 mixed events
--
-- Manual edge function test:
-- curl -X POST \
--   "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-baselines" \
--   -H "Authorization: Bearer <ADMIN_JWT>" \
--   -H "Content-Type: application/json" \
--   -d '{"brandId":"<BRAND_ID_FROM_QUERY_9>"}'
