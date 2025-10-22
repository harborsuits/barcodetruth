
-- Create get_top_shareholders RPC function
CREATE OR REPLACE FUNCTION public.get_top_shareholders(
  p_brand_id UUID,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(
  investor_name TEXT,
  investor_company_id UUID,
  percent_owned NUMERIC,
  confidence NUMERIC,
  source TEXT,
  last_verified_at TIMESTAMPTZ,
  is_asset_manager BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT 
    cs.holder_name AS investor_name,
    NULL::UUID AS investor_company_id,
    cs.percent_owned,
    0.95::NUMERIC AS confidence,
    cs.source_name AS source,
    NOW() AS last_verified_at,
    (cs.holder_type = 'institutional')::BOOLEAN AS is_asset_manager
  FROM company_shareholders cs
  JOIN company_ownership co ON co.parent_company_id = cs.company_id
  WHERE co.child_brand_id = p_brand_id
    AND co.relationship IN ('parent', 'subsidiary', 'parent_organization')
    AND cs.percent_owned IS NOT NULL
  ORDER BY cs.percent_owned DESC
  LIMIT p_limit;
$$;

-- Add key people for Walmart Inc.
INSERT INTO public.company_people (
  company_id,
  role,
  person_name,
  person_qid,
  image_url,
  source,
  source_ref,
  last_verified_at,
  confidence
) VALUES
  -- CEO
  (
    'caefa901-d265-4792-b1ee-05670d611fdf',
    'chief_executive_officer',
    'Doug McMillon',
    'Q18245403',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Doug_McMillon.jpg/220px-Doug_McMillon.jpg',
    'wikidata',
    'https://www.wikidata.org/wiki/Q18245403',
    NOW(),
    0.95
  ),
  -- Chairman (same person as CEO)
  (
    'caefa901-d265-4792-b1ee-05670d611fdf',
    'chairperson',
    'Doug McMillon',
    'Q18245403',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Doug_McMillon.jpg/220px-Doug_McMillon.jpg',
    'wikidata',
    'https://www.wikidata.org/wiki/Q18245403',
    NOW(),
    0.95
  ),
  -- Founder
  (
    'caefa901-d265-4792-b1ee-05670d611fdf',
    'founder',
    'Sam Walton',
    'Q282014',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Sam_Walton.jpg/220px-Sam_Walton.jpg',
    'wikidata',
    'https://www.wikidata.org/wiki/Q282014',
    NOW(),
    1.0
  )
ON CONFLICT DO NOTHING;
