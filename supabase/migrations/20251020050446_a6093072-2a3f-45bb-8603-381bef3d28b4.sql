-- Create simplified get_ownership_graph using existing columns
CREATE OR REPLACE FUNCTION public.get_ownership_graph(p_brand_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH RECURSIVE descendants AS (
  SELECT bo.brand_id AS node_id, bo.parent_brand_id, bo.relationship_type, bo.confidence
  FROM brand_ownerships bo
  WHERE bo.parent_brand_id = p_brand_id
  UNION ALL
  SELECT bo.brand_id, bo.parent_brand_id, bo.relationship_type, bo.confidence
  FROM descendants d
  JOIN brand_ownerships bo ON bo.parent_brand_id = d.node_id
), ancestors AS (
  SELECT bo.parent_brand_id AS node_id, bo.brand_id, bo.relationship_type, bo.confidence
  FROM brand_ownerships bo
  WHERE bo.brand_id = p_brand_id
  UNION ALL
  SELECT bo.parent_brand_id, bo.brand_id, bo.relationship_type, bo.confidence
  FROM ancestors a
  JOIN brand_ownerships bo ON bo.brand_id = a.node_id
), all_nodes AS (
  SELECT p_brand_id AS id
  UNION SELECT node_id FROM descendants
  UNION SELECT node_id FROM ancestors
)
SELECT jsonb_build_object(
  'nodes', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'logo', b.logo_url))
    FROM brands b JOIN all_nodes n ON n.id = b.id
  ), '[]'::jsonb),
  'edges', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'from', bo.parent_brand_id,
      'to', bo.brand_id,
      'type', bo.relationship_type::text,
      'confidence', bo.confidence
    ))
    FROM brand_ownerships bo
    WHERE EXISTS (SELECT 1 FROM all_nodes WHERE id = bo.brand_id)
      AND EXISTS (SELECT 1 FROM all_nodes WHERE id = bo.parent_brand_id)
  ), '[]'::jsonb),
  'center', p_brand_id
);
$$;

-- Create simplified get_brand_rollup_scores
CREATE OR REPLACE FUNCTION public.get_brand_rollup_scores(p_brand_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH RECURSIVE kids AS (
  SELECT bo.brand_id
  FROM brand_ownerships bo
  WHERE bo.parent_brand_id = p_brand_id
  UNION ALL
  SELECT bo.brand_id
  FROM kids k 
  JOIN brand_ownerships bo ON bo.parent_brand_id = k.brand_id
), scope AS (
  SELECT p_brand_id AS brand_id
  UNION ALL 
  SELECT brand_id FROM kids
)
SELECT jsonb_build_object(
  'score', ROUND(AVG(bs.score)::numeric, 0)::integer,
  'score_environment', ROUND(AVG(bs.score_environment)::numeric, 0)::integer,
  'score_labor', ROUND(AVG(bs.score_labor)::numeric, 0)::integer,
  'score_politics', ROUND(AVG(bs.score_politics)::numeric, 0)::integer,
  'score_social', ROUND(AVG(bs.score_social)::numeric, 0)::integer,
  'entity_count', COUNT(DISTINCT s.brand_id)::integer,
  'last_updated', MAX(bs.last_updated)
)
FROM brand_scores bs
JOIN scope s ON s.brand_id = bs.brand_id;
$$;

-- Create get_brand_feed_with_subsidiaries
CREATE OR REPLACE FUNCTION public.get_brand_feed_with_subsidiaries(
  p_brand_id uuid,
  p_include_subsidiaries boolean DEFAULT false,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  event_id uuid,
  brand_id uuid,
  brand_name text,
  title text,
  description text,
  category event_category,
  category_code text,
  severity text,
  verification verification_level,
  event_date timestamp with time zone,
  source_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH RECURSIVE kids AS (
  SELECT bo.brand_id
  FROM brand_ownerships bo
  WHERE bo.parent_brand_id = p_brand_id
  UNION ALL
  SELECT bo.brand_id
  FROM kids k 
  JOIN brand_ownerships bo ON bo.parent_brand_id = k.brand_id
),
scope AS (
  SELECT p_brand_id AS brand_id
  UNION ALL
  SELECT brand_id FROM kids WHERE p_include_subsidiaries
)
SELECT 
  be.event_id,
  be.brand_id,
  b.name AS brand_name,
  be.title,
  be.description,
  be.category,
  be.category_code,
  be.severity,
  be.verification,
  be.event_date,
  be.source_url
FROM brand_events be
JOIN brands b ON b.id = be.brand_id
JOIN scope s ON s.brand_id = be.brand_id
WHERE be.is_irrelevant = false
ORDER BY be.event_date DESC
LIMIT p_limit;
$$;