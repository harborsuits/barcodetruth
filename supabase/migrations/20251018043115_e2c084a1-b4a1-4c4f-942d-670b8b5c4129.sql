-- Add constraints for impact fields and missing columns
ALTER TABLE public.brand_events
  DROP CONSTRAINT IF EXISTS be_impact_bounds;

ALTER TABLE public.brand_events
  ADD COLUMN IF NOT EXISTS impact_confidence smallint,
  ADD COLUMN IF NOT EXISTS is_press_release boolean DEFAULT false;

ALTER TABLE public.brand_events
  ADD CONSTRAINT be_impact_bounds CHECK (
    (impact_labor        BETWEEN -5 AND 5 OR impact_labor        IS NULL) AND
    (impact_environment  BETWEEN -5 AND 5 OR impact_environment  IS NULL) AND
    (impact_politics     BETWEEN -5 AND 5 OR impact_politics     IS NULL) AND
    (impact_social       BETWEEN -5 AND 5 OR impact_social       IS NULL) AND
    (impact_confidence   BETWEEN  0 AND 100 OR impact_confidence IS NULL) AND
    (relevance_score     BETWEEN  0 AND 20  OR relevance_score   IS NULL)
  );

-- SQL RPC to compute brand scores from impact fields
CREATE OR REPLACE FUNCTION public.compute_brand_score(p_brand uuid)
RETURNS TABLE (
  brand_id uuid,
  score numeric,
  score_labor numeric,
  score_environment numeric,
  score_politics numeric,
  score_social numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
WITH e AS (
  SELECT
    COALESCE(impact_labor,0)       * 
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
    COALESCE(impact_politics,0)    *
      CASE WHEN verification='official' THEN 1.4 WHEN verification='corroborated' THEN 1.15 ELSE 1.0 END *
      CASE WHEN event_date >= now()-interval '30 days' THEN 1.0
           WHEN event_date >= now()-interval '90 days' THEN 0.7
           WHEN event_date >= now()-interval '365 days' THEN 0.4
           ELSE 0.2 END AS imp_p,
    COALESCE(impact_social,0)      *
      CASE WHEN verification='official' THEN 1.4 WHEN verification='corroborated' THEN 1.15 ELSE 1.0 END *
      CASE WHEN event_date >= now()-interval '30 days' THEN 1.0
           WHEN event_date >= now()-interval '90 days' THEN 0.7
           WHEN event_date >= now()-interval '365 days' THEN 0.4
           ELSE 0.2 END AS imp_s
  FROM brand_events
  WHERE brand_id = p_brand
    AND event_date >= now()-interval '365 days'
)
SELECT p_brand,
       GREATEST(0, LEAST(100, ROUND(50 + ( (COALESCE(SUM(imp_l),0)+COALESCE(SUM(imp_e),0)+COALESCE(SUM(imp_p),0)+COALESCE(SUM(imp_s),0)) * 2 ),1)))::numeric AS score,
       GREATEST(0, LEAST(100, ROUND(50 + ( COALESCE(SUM(imp_l),0) * 5 ),1)))::numeric        AS score_labor,
       GREATEST(0, LEAST(100, ROUND(50 + ( COALESCE(SUM(imp_e),0) * 5 ),1)))::numeric        AS score_environment,
       GREATEST(0, LEAST(100, ROUND(50 + ( COALESCE(SUM(imp_p),0) * 5 ),1)))::numeric        AS score_politics,
       GREATEST(0, LEAST(100, ROUND(50 + ( COALESCE(SUM(imp_s),0) * 5 ),1)))::numeric        AS score_social
FROM e;
$$;