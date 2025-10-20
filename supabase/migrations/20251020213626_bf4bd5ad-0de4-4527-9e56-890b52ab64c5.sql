
-- Drop and recreate get_brand_feed_with_subsidiaries with missing fields
DROP FUNCTION IF EXISTS public.get_brand_feed_with_subsidiaries(uuid, boolean, integer);

CREATE FUNCTION public.get_brand_feed_with_subsidiaries(
  p_brand_id uuid, 
  p_include_subsidiaries boolean DEFAULT false, 
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
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
  source_url text,
  is_parent_entity boolean,
  orientation text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
  be.source_url,
  (be.brand_id = p_brand_id) AS is_parent_entity,
  be.orientation
FROM brand_events be
JOIN brands b ON b.id = be.brand_id
JOIN scope s ON s.brand_id = be.brand_id
WHERE be.is_irrelevant = false
ORDER BY be.event_date DESC
LIMIT p_limit;
$$;
