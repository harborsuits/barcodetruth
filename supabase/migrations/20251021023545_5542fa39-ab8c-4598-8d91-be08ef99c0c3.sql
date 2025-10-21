-- Step 2: Recalculate scores for all active brands
INSERT INTO brand_scores (brand_id, score, score_labor, score_environment, score_politics, score_social, last_updated)
SELECT 
  brand_id,
  score::integer,
  score_labor::integer,
  score_environment::integer,
  score_politics::integer,
  score_social::integer,
  NOW()
FROM brands b
CROSS JOIN LATERAL compute_brand_score(b.id)
WHERE b.is_active = true
ON CONFLICT (brand_id)
DO UPDATE SET
  score = EXCLUDED.score,
  score_labor = EXCLUDED.score_labor,
  score_environment = EXCLUDED.score_environment,
  score_politics = EXCLUDED.score_politics,
  score_social = EXCLUDED.score_social,
  last_updated = NOW();