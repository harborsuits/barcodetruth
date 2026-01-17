-- Step 1: Create view to compute evidence coverage per brand per dimension
CREATE OR REPLACE VIEW public.v_brand_dimension_evidence AS
WITH event_stats AS (
  SELECT
    be.brand_id,
    be.category::text AS dimension,
    COUNT(*) FILTER (WHERE be.is_irrelevant IS DISTINCT FROM true) AS evidence_count,
    COUNT(DISTINCT 
      CASE 
        WHEN be.source_url IS NOT NULL AND be.is_irrelevant IS DISTINCT FROM true 
        THEN substring(be.source_url from 'https?://([^/]+)')
      END
    ) AS distinct_domains,
    MAX(be.created_at) FILTER (WHERE be.is_irrelevant IS DISTINCT FROM true) AS latest_evidence,
    COUNT(*) FILTER (WHERE be.verification IN ('official', 'corroborated') AND be.is_irrelevant IS DISTINCT FROM true) AS verified_count
  FROM public.brand_events be
  WHERE be.category IS NOT NULL
  GROUP BY be.brand_id, be.category
)
SELECT
  brand_id,
  dimension,
  evidence_count,
  distinct_domains,
  verified_count,
  latest_evidence,
  CASE
    WHEN distinct_domains >= 3 OR evidence_count >= 6 OR verified_count >= 3 THEN 'high'
    WHEN distinct_domains >= 2 OR evidence_count >= 3 OR verified_count >= 1 THEN 'medium'
    WHEN evidence_count >= 1 THEN 'low'
    ELSE 'none'
  END AS confidence_level
FROM event_stats;

-- Step 2: Pivoted view for easy lookup
CREATE OR REPLACE VIEW public.v_brand_confidence_pivot AS
SELECT
  b.id AS brand_id,
  COALESCE(MAX(v.confidence_level) FILTER (WHERE v.dimension = 'labor'), 'none') AS labor_confidence,
  COALESCE(MAX(v.confidence_level) FILTER (WHERE v.dimension = 'environment'), 'none') AS environment_confidence,
  COALESCE(MAX(v.confidence_level) FILTER (WHERE v.dimension = 'politics'), 'none') AS politics_confidence,
  COALESCE(MAX(v.confidence_level) FILTER (WHERE v.dimension = 'social'), 'none') AS social_confidence,
  COUNT(DISTINCT v.dimension) FILTER (WHERE v.confidence_level IS DISTINCT FROM 'none') AS dimensions_with_evidence
FROM public.brands b
LEFT JOIN public.v_brand_dimension_evidence v ON v.brand_id = b.id
GROUP BY b.id;

-- Step 3: Update RPC to use evidence-based confidence
CREATE OR REPLACE FUNCTION personalized_brand_score_v2(
  p_brand_id uuid,
  p_user_id uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_brand_scores RECORD;
  v_confidence_data RECORD;
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
  v_none_conf_count int := 0;
BEGIN
  SELECT bs.score_labor, bs.score_environment, bs.score_politics, bs.score_social
  INTO v_brand_scores FROM brand_scores bs WHERE bs.brand_id = p_brand_id;
  
  IF v_brand_scores IS NULL THEN
    RETURN jsonb_build_object('score', NULL, 'confidence', 'low', 'confidenceReason', 'No scores calculated', 'drivers', '[]'::jsonb, 'dealbreaker', '{"triggered": false}'::jsonb, 'excludedDimensions', '[]'::jsonb, 'includedDimensions', '[]'::jsonb, 'summary', 'Score not yet available', 'isPersonalized', false);
  END IF;
  
  SELECT labor_confidence, environment_confidence, politics_confidence, social_confidence, dimensions_with_evidence
  INTO v_confidence_data FROM v_brand_confidence_pivot WHERE brand_id = p_brand_id;
  
  IF p_user_id IS NOT NULL THEN
    SELECT COALESCE(up.cares_labor, 50), COALESCE(up.cares_environment, 50), COALESCE(up.cares_politics, 50), COALESCE(up.cares_social, 50)
    INTO v_user_prefs FROM user_profiles up WHERE up.user_id = p_user_id;
    IF v_user_prefs IS NOT NULL THEN
      v_is_personalized := true;
      v_weights := jsonb_build_object('labor', v_user_prefs.cares_labor, 'environment', v_user_prefs.cares_environment, 'politics', v_user_prefs.cares_politics, 'social', v_user_prefs.cares_social);
    END IF;
  END IF;
  
  IF v_weights IS NULL THEN v_weights := '{"labor": 50, "environment": 50, "politics": 50, "social": 50}'::jsonb; END IF;
  
  v_total_weight := (v_weights->>'labor')::numeric + (v_weights->>'environment')::numeric + (v_weights->>'politics')::numeric + (v_weights->>'social')::numeric;
  IF v_total_weight = 0 THEN v_total_weight := 200; END IF;
  
  v_normalized_weights := jsonb_build_object('labor', (v_weights->>'labor')::numeric / v_total_weight, 'environment', (v_weights->>'environment')::numeric / v_total_weight, 'politics', (v_weights->>'politics')::numeric / v_total_weight, 'social', (v_weights->>'social')::numeric / v_total_weight);
  
  FOREACH v_dim IN ARRAY v_dims LOOP
    CASE v_dim WHEN 'labor' THEN v_dim_score := v_brand_scores.score_labor; WHEN 'environment' THEN v_dim_score := v_brand_scores.score_environment; WHEN 'politics' THEN v_dim_score := v_brand_scores.score_politics; WHEN 'social' THEN v_dim_score := v_brand_scores.score_social; END CASE;
    
    IF v_dim_score IS NULL THEN v_excluded_dims := array_append(v_excluded_dims, v_dim); CONTINUE; END IF;
    
    v_included_dims := array_append(v_included_dims, v_dim);
    v_dim_weight := (v_normalized_weights->>v_dim)::numeric;
    
    CASE v_dim WHEN 'labor' THEN v_confidence := COALESCE(v_confidence_data.labor_confidence, 'none'); WHEN 'environment' THEN v_confidence := COALESCE(v_confidence_data.environment_confidence, 'none'); WHEN 'politics' THEN v_confidence := COALESCE(v_confidence_data.politics_confidence, 'none'); WHEN 'social' THEN v_confidence := COALESCE(v_confidence_data.social_confidence, 'none'); END CASE;
    
    CASE v_confidence WHEN 'high' THEN v_confidence_mult := 1.00; v_high_conf_count := v_high_conf_count + 1; WHEN 'medium' THEN v_confidence_mult := 0.95; WHEN 'low' THEN v_confidence_mult := 0.85; v_low_conf_count := v_low_conf_count + 1; ELSE v_confidence_mult := 0.80; v_low_conf_count := v_low_conf_count + 1; v_none_conf_count := v_none_conf_count + 1; END CASE;
    
    v_contribution := v_dim_score * v_dim_weight * v_confidence_mult;
    v_raw_score := v_raw_score + (v_dim_score * v_dim_weight);
    v_adjusted_score := v_adjusted_score + v_contribution;
    v_total_used_weight := v_total_used_weight + v_dim_weight;
    
    IF v_dim_score >= 70 THEN v_impact := 'positive'; ELSIF v_dim_score >= 40 THEN v_impact := 'neutral'; ELSE v_impact := 'negative'; END IF;
    
    v_drivers := v_drivers || jsonb_build_array(jsonb_build_object('dimension', v_dim, 'score', v_dim_score, 'weight', v_dim_weight, 'weightRaw', (v_weights->>v_dim)::numeric, 'confidence', v_confidence, 'confidenceMult', v_confidence_mult, 'contribution', v_contribution, 'impact', v_impact));
  END LOOP;
  
  IF v_total_used_weight > 0 AND v_total_used_weight < 1.0 THEN v_adjusted_score := v_adjusted_score / v_total_used_weight; v_raw_score := v_raw_score / v_total_used_weight; END IF;
  
  IF v_none_conf_count >= 2 THEN v_overall_confidence := 'low'; ELSIF v_high_conf_count >= 2 THEN v_overall_confidence := 'high'; ELSIF v_low_conf_count >= 2 THEN v_overall_confidence := 'low'; ELSE v_overall_confidence := 'medium'; END IF;
  
  IF v_adjusted_score >= 70 THEN v_summary := 'Strong alignment with your values'; ELSIF v_adjusted_score >= 50 THEN v_summary := 'Moderate alignment with your values'; ELSIF v_adjusted_score >= 30 THEN v_summary := 'Limited alignment with your values'; ELSE v_summary := 'Poor alignment with your values'; END IF;
  IF NOT v_is_personalized THEN v_summary := regexp_replace(v_summary, 'your values', 'average consumer values'); END IF;
  IF v_overall_confidence = 'low' THEN v_summary := v_summary || ' (limited evidence)'; END IF;
  
  RETURN jsonb_build_object('score', ROUND(v_adjusted_score), 'scoreRaw', ROUND(v_raw_score), 'confidence', v_overall_confidence, 'confidenceReason', CASE WHEN v_none_conf_count >= 2 THEN 'Multiple dimensions lack evidence' WHEN v_high_conf_count >= 2 THEN 'Strong evidence across dimensions' WHEN v_low_conf_count >= 2 THEN 'Limited evidence for some dimensions' ELSE 'Mixed evidence quality' END, 'drivers', v_drivers, 'dealbreaker', v_dealbreaker, 'excludedDimensions', to_jsonb(v_excluded_dims), 'includedDimensions', to_jsonb(v_included_dims), 'summary', v_summary, 'isPersonalized', v_is_personalized, 'dimensionsWithEvidence', COALESCE(v_confidence_data.dimensions_with_evidence, 0));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;