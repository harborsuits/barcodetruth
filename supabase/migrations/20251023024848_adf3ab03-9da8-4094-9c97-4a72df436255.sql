-- Update get_top_shareholders to fallback to company_ownership_details if company_shareholders is empty
DROP FUNCTION IF EXISTS get_top_shareholders(uuid, integer);

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
  WITH parent_company AS (
    SELECT co.parent_company_id
    FROM company_ownership co
    WHERE co.child_brand_id = p_brand_id
      AND co.relationship_type IN ('control')
    ORDER BY co.confidence DESC NULLS LAST
    LIMIT 1
  ),
  -- First try company_shareholders (enriched data)
  enriched_shareholders AS (
    SELECT 
      cs.holder_name as investor_name,
      cs.directory_id as investor_company_id,
      cs.pct,
      0.85::numeric as confidence,
      cs.source_name as source,
      cs.created_at as last_verified_at,
      COALESCE(cs.is_asset_manager, false) as is_asset_manager,
      1 as priority
    FROM company_shareholders cs
    WHERE cs.company_id = (SELECT parent_company_id FROM parent_company)
  ),
  -- Fallback to company_ownership_details
  ownership_details AS (
    SELECT 
      cod.owner_name as investor_name,
      NULL::uuid as investor_company_id,
      cod.percent_owned as pct,
      COALESCE(cod.confidence, 0.7)::numeric as confidence,
      cod.source as source,
      cod.created_at as last_verified_at,
      (cod.owner_type = 'asset_manager')::boolean as is_asset_manager,
      2 as priority
    FROM company_ownership_details cod
    WHERE cod.company_id = (SELECT parent_company_id FROM parent_company)
      AND cod.owner_type IN ('institutional_investor', 'asset_manager', 'corporation')
      AND cod.percent_owned IS NOT NULL
  ),
  -- Combine both sources
  combined AS (
    SELECT * FROM enriched_shareholders
    UNION ALL
    SELECT * FROM ownership_details
  )
  SELECT 
    investor_name,
    investor_company_id,
    pct,
    confidence,
    source,
    last_verified_at,
    is_asset_manager
  FROM combined
  ORDER BY priority ASC, pct DESC NULLS LAST
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION get_top_shareholders IS 'Gets top shareholders for a brand via parent company. Falls back to company_ownership_details if company_shareholders is empty.';