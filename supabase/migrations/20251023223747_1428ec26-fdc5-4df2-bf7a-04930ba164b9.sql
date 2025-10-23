-- Create view for brand quick take snapshot with proper column aliases
CREATE OR REPLACE VIEW public.v_brand_quick_take AS
SELECT
  bs.brand_id,
  -- Composite score: average of all category scores
  ROUND(
    (COALESCE(bs.score_labor, 50) + 
     COALESCE(bs.score_environment, 50) + 
     COALESCE(bs.score_politics, 50) + 
     COALESCE(bs.score_social, 50)) / 4.0
  )::INTEGER AS composite_score,
  bs.score_labor AS labor_score,
  bs.score_environment AS environment_score,
  bs.score_politics AS politics_score,
  bs.score_social AS social_score,
  bs.last_updated
FROM brand_scores bs;

-- Grant access to view
GRANT SELECT ON public.v_brand_quick_take TO anon, authenticated;

-- Create RPC function to fetch quick take data
CREATE OR REPLACE FUNCTION public.rpc_get_brand_quick_take(p_brand_id uuid)
RETURNS TABLE (
  composite_score INTEGER,
  labor_score INTEGER,
  environment_score INTEGER,
  politics_score INTEGER,
  social_score INTEGER,
  last_updated TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    composite_score,
    labor_score,
    environment_score,
    politics_score,
    social_score,
    last_updated
  FROM public.v_brand_quick_take
  WHERE brand_id = p_brand_id;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.rpc_get_brand_quick_take(uuid) TO anon, authenticated;