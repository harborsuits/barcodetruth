
CREATE OR REPLACE FUNCTION public.get_fair_feed(
  p_limit integer DEFAULT 50,
  p_max_per_brand integer DEFAULT 3
)
RETURNS TABLE(
  event_id uuid,
  title text,
  category text,
  event_date timestamptz,
  created_at timestamptz,
  source_url text,
  brand_id uuid,
  brand_name text,
  brand_logo_url text,
  parent_company text,
  materiality_score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT 
      e.event_id,
      e.title,
      e.category,
      e.event_date,
      e.created_at,
      e.source_url,
      e.brand_id,
      b.name as brand_name,
      b.logo_url as brand_logo_url,
      b.parent_company,
      CASE 
        WHEN e.score_eligible = true THEN 
          (CASE WHEN e.source_tier IN ('tier_1', 'tier_2') THEN 2.0 ELSE 1.0 END)
          * (CASE e.severity WHEN 'severe' THEN 3.0 WHEN 'moderate' THEN 2.0 WHEN 'minor' THEN 1.0 ELSE 0.5 END)
          * (1.0 / (1.0 + EXTRACT(EPOCH FROM now() - e.created_at) / 86400.0))
        ELSE 0.1
      END as materiality_score,
      ROW_NUMBER() OVER (PARTITION BY e.brand_id ORDER BY e.created_at DESC) as brand_rank
    FROM brand_events e
    JOIN brands b ON b.id = e.brand_id
    WHERE e.created_at > now() - interval '30 days'
      AND e.is_irrelevant = false
  ),
  capped AS (
    SELECT * FROM ranked WHERE brand_rank <= p_max_per_brand
  ),
  parent_capped AS (
    SELECT *,
      ROW_NUMBER() OVER (PARTITION BY parent_company ORDER BY materiality_score DESC) as parent_rank,
      COUNT(*) OVER () as total_rows
    FROM capped
  )
  SELECT 
    pc.event_id,
    pc.title,
    pc.category,
    pc.event_date,
    pc.created_at,
    pc.source_url,
    pc.brand_id,
    pc.brand_name,
    pc.brand_logo_url,
    pc.parent_company,
    pc.materiality_score
  FROM parent_capped pc
  WHERE pc.parent_company IS NULL 
     OR pc.parent_rank <= GREATEST(3, (pc.total_rows * 10 / 100))
  ORDER BY pc.materiality_score DESC
  LIMIT p_limit;
$$;
