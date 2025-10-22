
-- Drop and recreate the get_brand_ownership function with proper logic
DROP FUNCTION IF EXISTS get_brand_ownership(uuid);

CREATE OR REPLACE FUNCTION get_brand_ownership(p_brand_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_result jsonb;
  v_control_chain jsonb;
  v_siblings jsonb;
  v_shareholder_data jsonb;
BEGIN
  -- Step 1: Find the parent company for this brand
  -- Look in company_relations for brand_of or subsidiary_of relationships
  SELECT parent_id INTO v_company_id
  FROM company_relations
  WHERE child_id = p_brand_id
    AND relation IN ('brand_of', 'subsidiary_of', 'owned_by')
  ORDER BY confidence DESC, created_at DESC
  LIMIT 1;

  -- If no relation found, check if the brand itself has a company record
  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id
    FROM companies c
    WHERE EXISTS (
      SELECT 1 FROM brands b 
      WHERE b.id = p_brand_id 
      AND (b.wikidata_qid = c.wikidata_qid OR b.name = c.name)
    )
    LIMIT 1;
  END IF;

  -- Step 2: Try to get cached data
  IF v_company_id IS NOT NULL THEN
    SELECT 
      control_chain_json,
      siblings_json,
      shareholder_breakdown_json
    INTO 
      v_control_chain,
      v_siblings,
      v_shareholder_data
    FROM company_groups_cache
    WHERE company_id = v_company_id;
  END IF;

  -- Step 3: If no cache, build minimal structure
  IF v_control_chain IS NULL THEN
    -- Build a minimal chain from the brand
    SELECT jsonb_build_array(
      jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'type', 'brand',
        'logo_url', b.logo_url
      )
    ) INTO v_control_chain
    FROM brands b
    WHERE b.id = p_brand_id;
    
    -- Add the parent company if found
    IF v_company_id IS NOT NULL THEN
      SELECT v_control_chain || jsonb_build_array(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'type', 'company',
          'is_public', c.is_public,
          'ticker', c.ticker,
          'relation', 'brand_of',
          'source', 'company_relations',
          'confidence', 0.8
        )
      ) INTO v_control_chain
      FROM companies c
      WHERE c.id = v_company_id;
    END IF;
    
    v_siblings := '[]'::jsonb;
    v_shareholder_data := '{}'::jsonb;
  END IF;

  -- Step 4: Build result
  v_result := jsonb_build_object(
    'company_id', v_company_id,
    'structure', jsonb_build_object(
      'chain', COALESCE(v_control_chain, '[]'::jsonb),
      'siblings', COALESCE(v_siblings, '[]'::jsonb)
    ),
    'shareholders', COALESCE(v_shareholder_data, '{}'::jsonb)
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_brand_ownership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_brand_ownership(uuid) TO anon;
