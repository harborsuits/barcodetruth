
-- Server-side canonical personalized scoring RPC (v3 hardened)
-- Matches alignmentScore.ts formula exactly:
-- 1. Normalize user weights to sum to 1.0
-- 2. Dampen dimension scores by confidence (low=0.5, medium=0.85, high=1.0)
-- 3. Weighted sum = Σ(dampened_score × normalized_weight)
-- 4. Renormalize if dimensions excluded

CREATE OR REPLACE FUNCTION public.personalized_brand_score_v3(
  p_brand_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scores RECORD;
  v_prefs RECORD;
  v_reason RECORD;
  
  -- User weights (raw 0-100)
  w_labor numeric := 50;
  w_env numeric := 50;
  w_pol numeric := 50;
  w_soc numeric := 50;
  w_total numeric;
  
  -- Normalized weights (sum to 1)
  nw_labor numeric;
  nw_env numeric;
  nw_pol numeric;
  nw_soc numeric;
  
  -- Dimension event counts
  ec_labor int := 0;
  ec_env int := 0;
  ec_pol int := 0;
  ec_soc int := 0;
  
  -- Confidence multipliers
  cm_labor numeric;
  cm_env numeric;
  cm_pol numeric;
  cm_soc numeric;
  
  -- Effective (dampened) scores
  eff_labor numeric;
  eff_env numeric;
  eff_pol numeric;
  eff_soc numeric;
  
  v_raw_score numeric;
  v_adj_score numeric;
  v_total_weight numeric;
  v_is_personalized boolean := false;
BEGIN
  -- 1. Get brand dimension scores
  SELECT score_labor, score_environment, score_politics, score_social, reason_json
  INTO v_scores
  FROM brand_scores
  WHERE brand_id = p_brand_id;
  
  IF v_scores IS NULL THEN
    RETURN jsonb_build_object('score', NULL, 'confidence', 'low', 'reason', 'No scores available');
  END IF;
  
  -- 2. Get user preferences if user provided
  IF p_user_id IS NOT NULL THEN
    SELECT cares_labor, cares_environment, cares_politics, cares_social
    INTO v_prefs
    FROM user_profiles
    WHERE user_id = p_user_id;
    
    IF v_prefs IS NOT NULL THEN
      w_labor := COALESCE(v_prefs.cares_labor, 50);
      w_env := COALESCE(v_prefs.cares_environment, 50);
      w_pol := COALESCE(v_prefs.cares_politics, 50);
      w_soc := COALESCE(v_prefs.cares_social, 50);
      v_is_personalized := true;
    END IF;
  END IF;
  
  -- 3. Normalize weights to sum to 1.0
  w_total := w_labor + w_env + w_pol + w_soc;
  IF w_total = 0 THEN
    nw_labor := 0.25; nw_env := 0.25; nw_pol := 0.25; nw_soc := 0.25;
  ELSE
    nw_labor := w_labor / w_total;
    nw_env := w_env / w_total;
    nw_pol := w_pol / w_total;
    nw_soc := w_soc / w_total;
  END IF;
  
  -- 4. Get event counts from reason_json for confidence
  IF v_scores.reason_json IS NOT NULL AND v_scores.reason_json ? 'dimension_counts' THEN
    ec_labor := COALESCE((v_scores.reason_json->'dimension_counts'->>'labor')::int, 0);
    ec_env := COALESCE((v_scores.reason_json->'dimension_counts'->>'environment')::int, 0);
    ec_pol := COALESCE((v_scores.reason_json->'dimension_counts'->>'politics')::int, 0);
    ec_soc := COALESCE((v_scores.reason_json->'dimension_counts'->>'social')::int, 0);
  END IF;
  
  -- 5. Compute confidence multipliers (low=0.5, medium=0.85, high=1.0)
  cm_labor := CASE WHEN ec_labor >= 5 THEN 1.0 WHEN ec_labor >= 2 THEN 0.85 ELSE 0.5 END;
  cm_env := CASE WHEN ec_env >= 5 THEN 1.0 WHEN ec_env >= 2 THEN 0.85 ELSE 0.5 END;
  cm_pol := CASE WHEN ec_pol >= 5 THEN 1.0 WHEN ec_pol >= 2 THEN 0.85 ELSE 0.5 END;
  cm_soc := CASE WHEN ec_soc >= 5 THEN 1.0 WHEN ec_soc >= 2 THEN 0.85 ELSE 0.5 END;
  
  -- Also treat score=50 (neutral default) as low confidence
  IF v_scores.score_labor = 50 AND ec_labor = 0 THEN cm_labor := 0.5; END IF;
  IF v_scores.score_environment = 50 AND ec_env = 0 THEN cm_env := 0.5; END IF;
  IF v_scores.score_politics = 50 AND ec_pol = 0 THEN cm_pol := 0.5; END IF;
  IF v_scores.score_social = 50 AND ec_soc = 0 THEN cm_soc := 0.5; END IF;
  
  -- 6. Dampen scores toward neutral (50) based on confidence
  eff_labor := 50 + (COALESCE(v_scores.score_labor, 50) - 50) * cm_labor;
  eff_env := 50 + (COALESCE(v_scores.score_environment, 50) - 50) * cm_env;
  eff_pol := 50 + (COALESCE(v_scores.score_politics, 50) - 50) * cm_pol;
  eff_soc := 50 + (COALESCE(v_scores.score_social, 50) - 50) * cm_soc;
  
  -- 7. Weighted sum
  v_raw_score := COALESCE(v_scores.score_labor, 50) * nw_labor +
                 COALESCE(v_scores.score_environment, 50) * nw_env +
                 COALESCE(v_scores.score_politics, 50) * nw_pol +
                 COALESCE(v_scores.score_social, 50) * nw_soc;
  
  v_adj_score := eff_labor * nw_labor +
                 eff_env * nw_env +
                 eff_pol * nw_pol +
                 eff_soc * nw_soc;
  
  RETURN jsonb_build_object(
    'score', ROUND(v_adj_score),
    'scoreRaw', ROUND(v_raw_score),
    'isPersonalized', v_is_personalized,
    'confidence', CASE
      WHEN (ec_labor + ec_env + ec_pol + ec_soc) = 0 THEN 'low'
      WHEN LEAST(cm_labor, cm_env, cm_pol, cm_soc) >= 0.85 THEN 'high'
      WHEN (cm_labor + cm_env + cm_pol + cm_soc) / 4.0 >= 0.7 THEN 'medium'
      ELSE 'low'
    END,
    'dimensions', jsonb_build_object(
      'labor', jsonb_build_object('raw', v_scores.score_labor, 'effective', ROUND(eff_labor), 'weight', ROUND(nw_labor::numeric, 3), 'events', ec_labor),
      'environment', jsonb_build_object('raw', v_scores.score_environment, 'effective', ROUND(eff_env), 'weight', ROUND(nw_env::numeric, 3), 'events', ec_env),
      'politics', jsonb_build_object('raw', v_scores.score_politics, 'effective', ROUND(eff_pol), 'weight', ROUND(nw_pol::numeric, 3), 'events', ec_pol),
      'social', jsonb_build_object('raw', v_scores.score_social, 'effective', ROUND(eff_soc), 'weight', ROUND(nw_soc::numeric, 3), 'events', ec_soc)
    )
  );
END;
$$;
