-- Add RPC to get subsidiaries owned by a company
CREATE OR REPLACE FUNCTION public.rpc_get_brand_subsidiaries(p_brand_id uuid)
RETURNS TABLE (
  brand_id uuid,
  brand_name text,
  logo_url text,
  relationship text,
  confidence numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  WITH parent_company AS (
    -- Get the parent company for this brand
    SELECT co.parent_company_id
    FROM company_ownership co
    WHERE co.child_brand_id = p_brand_id
      AND co.relationship IN ('parent', 'subsidiary', 'parent_organization')
      AND co.confidence >= 0.7
    ORDER BY co.confidence DESC
    LIMIT 1
  ),
  -- Get all brands owned by this parent company
  siblings AS (
    SELECT 
      co.child_brand_id,
      co.relationship,
      co.confidence
    FROM parent_company pc
    JOIN company_ownership co ON co.parent_company_id = pc.parent_company_id
    WHERE co.child_brand_id IS NOT NULL
      AND co.child_brand_id != p_brand_id
      AND co.relationship IN ('parent', 'subsidiary', 'parent_organization')
      AND co.confidence >= 0.7
  )
  SELECT 
    b.id as brand_id,
    b.name as brand_name,
    b.logo_url,
    s.relationship,
    s.confidence
  FROM siblings s
  JOIN brands b ON b.id = s.child_brand_id
  WHERE b.is_active = true
  ORDER BY b.name;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_brand_subsidiaries(uuid) TO anon, authenticated;