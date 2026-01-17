-- Drop existing RPC if it exists and create new one that returns full alignment result
DROP FUNCTION IF EXISTS personalized_brand_score_v2(uuid, uuid);

CREATE OR REPLACE FUNCTION personalized_brand_score_v2(
  p_brand_id uuid,
  p_user_id uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_brand_scores RECORD;
  v_user_prefs RECORD;
  v_weights jsonb;
  v_normalized_weights jsonb;
  v_total_weight numeric;
  v_raw_score numeric := 0;
  v_adjusted_score numeric := 0;
  v_total_used_weight numeric := 0;
  v_drivers jsonb := '[]'::jsonb;
  v_excluded_dims text[] := ARRAY[]::text[];
  v_included_dims text[] := ARRAY[]::text[];
  v_dim text;
  v_dims text[] := ARRAY['labor', 'environment', 'politics', 'social'];
  v_dim_score numeric;
  v_dim_weight numeric;
  v_contribution numeric;
  v_confidence text;
  v_confidence_mult numeric;
  v_impact text;
  v_is_personalized boolean := false;
  v_dealbreaker jsonb := '{"triggered": false}'::jsonb;
  v_summary text;
  v_overall_confidence text := 'medium';
  v_low_conf_count int := 0;
  v_high_conf_count int := 0;
BEGIN
  -- Get brand scores
  SELECT 
    bs.score_labor,
    bs.score_environment,
    bs.score_politics,
    bs.score_social
  INTO v_brand_scores
  FROM brand_scores bs
  WHERE bs.brand_id = p_brand_id;
  
  -- If no brand scores found, return null result
  IF v_brand_scores IS NULL THEN
    RETURN jsonb_build_object(
      'score', NULL,
      'scoreRaw', NULL,
      'confidence', 'low',
      'confidenceReason', 'No scores calculated for this brand',
      'drivers', '[]'::jsonb,
      'dealbreaker', '{"triggered": false}'::jsonb,
      'excludedDimensions', '[]'::jsonb,
      'includedDimensions', '[]'::jsonb,
      'summary', 'Score not yet available',
      'isPersonalized', false
    );
  END IF;
  
  -- Get user preferences if user_id provided
  IF p_user_id IS NOT NULL THEN
    SELECT 
      COALESCE(up.cares_labor, 50) as labor,
      COALESCE(up.cares_environment, 50) as environment,
      COALESCE(up.cares_politics, 50) as politics,
      COALESCE(up.cares_social, 50) as social
    INTO v_user_prefs
    FROM user_profiles up
    WHERE up.user_id = p_user_id;
    
    IF v_user_prefs IS NOT NULL THEN
      v_is_personalized := true;
      v_weights := jsonb_build_object(
        'labor', v_user_prefs.labor,
        'environment', v_user_prefs.environment,
        'politics', v_user_prefs.politics,
        'social', v_user_prefs.social
      );
    END IF;
  END IF;
  
  -- Default to equal weights if no user prefs
  IF v_weights IS NULL THEN
    v_weights := '{"labor": 50, "environment": 50, "politics": 50, "social": 50}'::jsonb;
  END IF;
  
  -- Calculate total weight for normalization
  v_total_weight := (v_weights->>'labor')::numeric + 
                    (v_weights->>'environment')::numeric + 
                    (v_weights->>'politics')::numeric + 
                    (v_weights->>'social')::numeric;
  
  IF v_total_weight = 0 THEN
    v_total_weight := 200; -- 50*4 default
  END IF;
  
  -- Calculate normalized weights
  v_normalized_weights := jsonb_build_object(
    'labor', (v_weights->>'labor')::numeric / v_total_weight,
    'environment', (v_weights->>'environment')::numeric / v_total_weight,
    'politics', (v_weights->>'politics')::numeric / v_total_weight,
    'social', (v_weights->>'social')::numeric / v_total_weight
  );
  
  -- Process each dimension
  FOREACH v_dim IN ARRAY v_dims LOOP
    -- Get dimension score
    CASE v_dim
      WHEN 'labor' THEN v_dim_score := v_brand_scores.score_labor;
      WHEN 'environment' THEN v_dim_score := v_brand_scores.score_environment;
      WHEN 'politics' THEN v_dim_score := v_brand_scores.score_politics;
      WHEN 'social' THEN v_dim_score := v_brand_scores.score_social;
    END CASE;
    
    -- Skip null dimensions
    IF v_dim_score IS NULL THEN
      v_excluded_dims := array_append(v_excluded_dims, v_dim);
      CONTINUE;
    END IF;
    
    v_included_dims := array_append(v_included_dims, v_dim);
    v_dim_weight := (v_normalized_weights->>v_dim)::numeric;
    
    -- Determine confidence (simple heuristic: 50 = low, otherwise medium)
    IF v_dim_score = 50 THEN
      v_confidence := 'low';
      v_confidence_mult := 0.85;
      v_low_conf_count := v_low_conf_count + 1;
    ELSE
      v_confidence := 'medium';
      v_confidence_mult := 0.95;
    END IF;
    
    -- Calculate contribution
    v_contribution := v_dim_score * v_dim_weight * v_confidence_mult;
    v_raw_score := v_raw_score + (v_dim_score * v_dim_weight);
    v_adjusted_score := v_adjusted_score + v_contribution;
    v_total_used_weight := v_total_used_weight + v_dim_weight;
    
    -- Determine impact
    IF v_dim_score >= 60 THEN
      v_impact := 'positive';
    ELSIF v_dim_score <= 40 THEN
      v_impact := 'negative';
    ELSE
      v_impact := 'neutral';
    END IF;
    
    -- Add to drivers
    v_drivers := v_drivers || jsonb_build_array(jsonb_build_object(
      'dimension', v_dim,
      'label', CASE v_dim 
        WHEN 'labor' THEN 'Labor Practices'
        WHEN 'environment' THEN 'Environment'
        WHEN 'politics' THEN 'Politics'
        WHEN 'social' THEN 'Social Impact'
      END,
      'impact', v_impact,
      'contribution', round(v_contribution::numeric, 2),
      'brandScore', v_dim_score,
      'userWeight', round(v_dim_weight::numeric, 4),
      'userWeightRaw', (v_weights->>v_dim)::numeric,
      'confidence', v_confidence
    ));
  END LOOP;
  
  -- Normalize if not all dimensions used
  IF v_total_used_weight > 0 AND v_total_used_weight < 0.99 THEN
    v_raw_score := v_raw_score / v_total_used_weight;
    v_adjusted_score := v_adjusted_score / v_total_used_weight;
  END IF;
  
  -- Determine overall confidence
  IF array_length(v_included_dims, 1) < 3 THEN
    v_overall_confidence := 'low';
  ELSIF v_low_conf_count >= 2 THEN
    v_overall_confidence := 'low';
  ELSIF v_high_conf_count >= 2 THEN
    v_overall_confidence := 'high';
  ELSE
    v_overall_confidence := 'medium';
  END IF;
  
  -- Generate summary
  IF v_adjusted_score >= 80 THEN
    v_summary := 'Strong alignment with your values';
  ELSIF v_adjusted_score >= 60 THEN
    v_summary := 'Good alignment overall';
  ELSIF v_adjusted_score >= 40 THEN
    v_summary := 'Mixed alignment – some values match, others don''t';
  ELSE
    v_summary := 'Limited alignment with your priorities';
  END IF;
  
  IF NOT v_is_personalized THEN
    v_summary := 'Baseline score (set your values to personalize)';
  END IF;
  
  RETURN jsonb_build_object(
    'score', round(v_adjusted_score),
    'scoreRaw', round(v_raw_score),
    'confidence', v_overall_confidence,
    'confidenceReason', CASE 
      WHEN array_length(v_included_dims, 1) < 3 THEN 'Only ' || array_length(v_included_dims, 1) || ' of 4 dimensions have data'
      WHEN v_low_conf_count >= 2 THEN 'Limited evidence across dimensions'
      ELSE 'Moderate evidence coverage'
    END,
    'drivers', v_drivers,
    'dealbreaker', v_dealbreaker,
    'excludedDimensions', to_jsonb(v_excluded_dims),
    'includedDimensions', to_jsonb(v_included_dims),
    'summary', v_summary,
    'isPersonalized', v_is_personalized
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION personalized_brand_score_v2(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION personalized_brand_score_v2(uuid, uuid) TO anon;