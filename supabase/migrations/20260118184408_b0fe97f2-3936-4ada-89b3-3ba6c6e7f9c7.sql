
-- Fix get_power_profit RPC with correct column names and logic
CREATE OR REPLACE FUNCTION get_power_profit(p_brand_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand RECORD;
  v_company RECORD;
  v_result JSONB;
  v_holders JSONB;
  v_leadership JSONB;
  v_parent JSONB;
BEGIN
  -- Get brand data
  SELECT id, name, company_type, ownership_confidence, ticker, wikidata_qid
  INTO v_brand
  FROM brands
  WHERE id = p_brand_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get matching company if exists
  SELECT c.id, c.name, c.ticker, c.exchange, c.is_public, c.country
  INTO v_company
  FROM companies c
  WHERE c.wikidata_qid = v_brand.wikidata_qid
  LIMIT 1;

  -- Get top holders (using correct column: pct)
  -- Order by numeric value in subquery, then aggregate
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', holder_name,
        'type', holder_type,
        'percent_owned', pct,  -- Use the actual column with data
        'is_asset_manager', COALESCE(is_asset_manager, false),
        'source', COALESCE(source_name, source),
        'as_of', as_of
      )
    ),
    '[]'::jsonb
  ) INTO v_holders
  FROM (
    SELECT holder_name, holder_type, pct, is_asset_manager, source_name, source, as_of
    FROM company_shareholders cs
    WHERE cs.company_id = v_company.id
      AND cs.pct IS NOT NULL  -- Only include holders with percentage
    ORDER BY cs.pct DESC NULLS LAST
    LIMIT 10
  ) ordered_holders;

  -- Get leadership
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', cp.name,
        'role', cp.role,
        'title', cp.title,
        'image_url', cp.image_url,
        'wikidata_qid', cp.person_qid
      )
    ),
    '[]'::jsonb
  ) INTO v_leadership
  FROM (
    SELECT name, role, title, image_url, person_qid
    FROM company_people cp
    WHERE cp.company_id = v_company.id
      AND cp.role IN ('ceo', 'chair', 'founder', 'board')
    ORDER BY CASE cp.role 
      WHEN 'ceo' THEN 1 
      WHEN 'chair' THEN 2 
      WHEN 'founder' THEN 3 
      ELSE 4 
    END
    LIMIT 5
  ) ordered_people;

  -- Get parent company (using child_brand_id, not child_company_id)
  SELECT jsonb_build_object(
    'id', COALESCE(co.parent_company_id::text, ''),
    'name', COALESCE(co.parent_name, pc.name, ''),
    'ticker', pc.ticker,
    'exchange', pc.exchange,
    'is_public', COALESCE(pc.is_public, false),
    'relationship', co.relationship,
    'confidence', co.confidence
  ) INTO v_parent
  FROM company_ownership co
  LEFT JOIN companies pc ON pc.id = co.parent_company_id
  WHERE co.child_brand_id = p_brand_id  -- Query by brand ID, not company ID
    AND co.relationship IN ('parent', 'subsidiary', 'parent_organization')
    AND co.confidence >= 0.7
  ORDER BY co.confidence DESC
  LIMIT 1;

  -- Build result
  v_result := jsonb_build_object(
    'brand_id', v_brand.id,
    'brand_name', v_brand.name,
    'company_type', COALESCE(v_brand.company_type, 'unknown'),
    'ownership_confidence', COALESCE(v_brand.ownership_confidence, 'none'),
    'ticker', COALESCE(v_brand.ticker, v_company.ticker),
    'exchange', v_company.exchange,
    'is_public', COALESCE(v_company.is_public, false),
    'company_name', v_company.name,
    'company_country', v_company.country,
    'top_holders', COALESCE(v_holders, '[]'::jsonb),
    'leadership', COALESCE(v_leadership, '[]'::jsonb),
    'has_parent', v_parent IS NOT NULL,
    'parent_company', v_parent
  );

  RETURN v_result;
END;
$$;
