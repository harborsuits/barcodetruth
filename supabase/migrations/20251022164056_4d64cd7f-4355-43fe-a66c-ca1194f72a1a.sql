
-- Update get_brand_ownership to include ownership details for private companies

CREATE OR REPLACE FUNCTION get_brand_ownership(p_brand_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_company_id uuid;
  v_chain jsonb := '[]'::jsonb;
  v_siblings jsonb := '[]'::jsonb;
  v_shareholders jsonb := '{}'::jsonb;
  v_ownership_details jsonb := '[]'::jsonb;
  v_ownership_structure jsonb := '{}'::jsonb;
BEGIN
  -- Get the brand's company
  SELECT co.parent_company_id INTO v_company_id
  FROM company_ownership co
  WHERE co.child_brand_id = p_brand_id
    AND co.relationship_type = 'control'
  ORDER BY co.confidence DESC
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Build ownership chain
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'type', 'company',
      'logo_url', c.logo_url,
      'is_public', c.is_public,
      'ticker', c.ticker,
      'relation', co.relationship,
      'confidence', co.confidence,
      'source', co.source
    )
    ORDER BY co.confidence DESC
  ) INTO v_chain
  FROM company_ownership co
  JOIN companies c ON c.id = co.parent_company_id
  WHERE co.child_brand_id = p_brand_id
    AND co.relationship_type = 'control';

  -- Get siblings (other brands owned by same company)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'type', 'brand',
      'logo_url', b.logo_url
    )
  ) INTO v_siblings
  FROM company_ownership co
  JOIN brands b ON b.id = co.child_brand_id
  WHERE co.parent_company_id = v_company_id
    AND co.child_brand_id != p_brand_id
    AND co.relationship_type = 'control'
  LIMIT 10;

  -- Get company details
  SELECT c.ownership_structure INTO v_ownership_structure
  FROM companies c
  WHERE c.id = v_company_id;

  -- Get ownership details (employee, family, etc.)
  SELECT jsonb_agg(
    jsonb_build_object(
      'type', cod.owner_type,
      'name', cod.owner_name,
      'percent', cod.percent_owned,
      'description', cod.description,
      'source', cod.source,
      'source_url', cod.source_url
    )
    ORDER BY cod.percent_owned DESC NULLS LAST
  ) INTO v_ownership_details
  FROM company_ownership_details cod
  WHERE cod.company_id = v_company_id;

  -- Get traditional shareholders (for public companies)
  SELECT jsonb_build_object(
    'subject_company', c.name,
    'as_of', MAX(cs.as_of)::text,
    'top', jsonb_agg(
      jsonb_build_object(
        'name', cs.holder_name,
        'type', cs.holder_type,
        'percent', cs.percent_owned,
        'url', cs.holder_url,
        'official_url', cs.holder_url,
        'wikipedia_url', cs.wikipedia_url,
        'wikidata_qid', cs.holder_wikidata_qid,
        'logo_url', cs.logo_url,
        'source_name', cs.source_name,
        'source_url', cs.source_url
      )
      ORDER BY cs.percent_owned DESC
    )
  ) INTO v_shareholders
  FROM companies c
  LEFT JOIN company_shareholders cs ON cs.company_id = c.id
  WHERE c.id = v_company_id
    AND c.is_public = true
  GROUP BY c.id, c.name
  HAVING COUNT(cs.id) > 0;

  -- Build final result
  v_result := jsonb_build_object(
    'company_id', v_company_id,
    'structure', jsonb_build_object(
      'chain', COALESCE(v_chain, '[]'::jsonb),
      'siblings', COALESCE(v_siblings, '[]'::jsonb)
    ),
    'ownership_structure', COALESCE(v_ownership_structure, '{}'::jsonb),
    'ownership_details', COALESCE(v_ownership_details, '[]'::jsonb),
    'shareholders', COALESCE(v_shareholders, '{}'::jsonb)
  );

  RETURN v_result;
END;
$$;
