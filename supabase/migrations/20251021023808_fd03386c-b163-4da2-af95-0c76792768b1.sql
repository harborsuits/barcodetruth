-- Step 1: Mark all financial noise as irrelevant
UPDATE brand_events
SET is_irrelevant = true
WHERE category_code IN ('NOISE.GENERAL', 'FIN.HOLDINGS', 'FIN.INSTITUTIONAL')
  OR title ~* 'shares? (sold|purchased|acquired|reduced)|holdings? (raised|reduced)|stake|position|portfolio';

-- Recalculate all scores using compute_brand_score (will ignore irrelevant events)
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