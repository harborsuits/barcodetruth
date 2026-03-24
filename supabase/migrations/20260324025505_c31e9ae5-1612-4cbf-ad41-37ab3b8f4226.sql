
CREATE OR REPLACE FUNCTION public.get_clustered_brand_events(
  p_brand_id uuid,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  event_id uuid,
  title text,
  category text,
  occurred_at timestamptz,
  source_url text,
  verification text,
  severity text,
  ai_summary text,
  cluster_size integer
)
LANGUAGE sql STABLE
AS $$
  WITH ranked AS (
    SELECT 
      be.event_id,
      be.title,
      be.category,
      be.occurred_at,
      be.source_url,
      be.verification,
      be.severity,
      be.ai_summary,
      ROW_NUMBER() OVER (
        PARTITION BY be.category, date_trunc('day', be.occurred_at)
        ORDER BY 
          CASE be.verification 
            WHEN 'official' THEN 1 
            WHEN 'corroborated' THEN 2 
            ELSE 3 
          END,
          be.occurred_at DESC
      ) AS rn,
      COUNT(*) OVER (
        PARTITION BY be.category, date_trunc('day', be.occurred_at)
      )::integer AS cluster_size
    FROM brand_events be
    WHERE be.brand_id = p_brand_id
      AND be.is_irrelevant = false
      AND be.occurred_at > now() - interval '90 days'
  )
  SELECT r.event_id, r.title, r.category, r.occurred_at, 
         r.source_url, r.verification, r.severity,
         r.ai_summary, r.cluster_size
  FROM ranked r
  WHERE r.rn = 1
  ORDER BY r.occurred_at DESC
  LIMIT p_limit;
$$;
