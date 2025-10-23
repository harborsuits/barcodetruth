-- Drop existing function and recreate with correct signature
DROP FUNCTION IF EXISTS get_top_shareholders(uuid, integer);

-- Create function to get top shareholders for a brand (via its parent company)
CREATE OR REPLACE FUNCTION get_top_shareholders(
  p_brand_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  investor_name text,
  investor_company_id uuid,
  pct numeric,
  confidence numeric,
  source text,
  last_verified_at timestamp with time zone,
  is_asset_manager boolean
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Get shareholders from the parent company
  SELECT 
    cs.holder_name as investor_name,
    cs.directory_id as investor_company_id,
    cs.pct,
    0.85::numeric as confidence,
    cs.source_name as source,
    cs.created_at as last_verified_at,
    COALESCE(cs.is_asset_manager, false) as is_asset_manager
  FROM company_shareholders cs
  WHERE cs.company_id = (
    -- Find the parent company for this brand
    SELECT co.parent_company_id
    FROM company_ownership co
    WHERE co.child_brand_id = p_brand_id
      AND co.relationship_type IN ('parent', 'parent_organization')
    ORDER BY co.confidence DESC NULLS LAST
    LIMIT 1
  )
  ORDER BY cs.pct DESC NULLS LAST
  LIMIT p_limit;
$$;