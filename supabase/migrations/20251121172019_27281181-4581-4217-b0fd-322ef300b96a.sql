-- Fix compute_brand_score to calculate overall score as average of category scores
-- instead of summing all impacts (which makes one bad category destroy overall score)

CREATE OR REPLACE FUNCTION public.compute_brand_score(p_brand uuid)
 RETURNS TABLE(brand_id uuid, score numeric, score_labor numeric, score_environment numeric, score_politics numeric, score_social numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH e AS (
  SELECT
    COALESCE(impact_labor,0) * 
      CASE WHEN verification='official' THEN 1.4 WHEN verification='corroborated' THEN 1.15 ELSE 1.0 END *
      CASE WHEN event_date >= now()-interval '30 days' THEN 1.0
           WHEN event_date >= now()-interval '90 days' THEN 0.7
           WHEN event_date >= now()-interval '365 days' THEN 0.4
           ELSE 0.2 END AS imp_l,
    COALESCE(impact_environment,0) * 
      CASE WHEN verification='official' THEN 1.4 WHEN verification='corroborated' THEN 1.15 ELSE 1.0 END *
      CASE WHEN event_date >= now()-interval '30 days' THEN 1.0
           WHEN event_date >= now()-interval '90 days' THEN 0.7
           WHEN event_date >= now()-interval '365 days' THEN 0.4
           ELSE 0.2 END AS imp_e,
    COALESCE(impact_politics,0) *
      CASE WHEN verification='official' THEN 1.4 WHEN verification='corroborated' THEN 1.15 ELSE 1.0 END *
      CASE WHEN event_date >= now()-interval '30 days' THEN 1.0
           WHEN event_date >= now()-interval '90 days' THEN 0.7
           WHEN event_date >= now()-interval '365 days' THEN 0.4
           ELSE 0.2 END AS imp_p,
    COALESCE(impact_social,0) *
      CASE WHEN verification='official' THEN 1.4 WHEN verification='corroborated' THEN 1.15 ELSE 1.0 END *
      CASE WHEN event_date >= now()-interval '30 days' THEN 1.0
           WHEN event_date >= now()-interval '90 days' THEN 0.7
           WHEN event_date >= now()-interval '365 days' THEN 0.4
           ELSE 0.2 END AS imp_s
  FROM brand_events
  WHERE brand_id = p_brand
    AND event_date >= now()-interval '365 days'
    AND is_irrelevant = false
),
category_scores AS (
  SELECT
    GREATEST(0, LEAST(100, ROUND(50 + ( COALESCE(SUM(imp_l),0) * 5 ),1)))::numeric AS score_labor,
    GREATEST(0, LEAST(100, ROUND(50 + ( COALESCE(SUM(imp_e),0) * 5 ),1)))::numeric AS score_environment,
    GREATEST(0, LEAST(100, ROUND(50 + ( COALESCE(SUM(imp_p),0) * 5 ),1)))::numeric AS score_politics,
    GREATEST(0, LEAST(100, ROUND(50 + ( COALESCE(SUM(imp_s),0) * 5 ),1)))::numeric AS score_social
  FROM e
)
SELECT 
  p_brand,
  -- NEW: Calculate overall as average of category scores (not sum of impacts)
  GREATEST(0, LEAST(100, ROUND((score_labor + score_environment + score_politics + score_social) / 4.0, 1)))::numeric AS score,
  score_labor,
  score_environment,
  score_politics,
  score_social
FROM category_scores;
$function$;