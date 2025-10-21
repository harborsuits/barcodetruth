-- Fix get_brand_company_info function - remove unnecessary jsonb_agg since we use LIMIT 1
CREATE OR REPLACE FUNCTION get_brand_company_info(p_brand_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'ownership', (
      SELECT jsonb_build_object(
        'parent_name', co.parent_name,
        'relationship', co.relationship,
        'confidence', co.confidence,
        'source', co.source,
        'company', (
          SELECT jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'ticker', c.ticker,
            'exchange', c.exchange,
            'is_public', c.is_public,
            'country', c.country,
            'description', c.description,
            'logo_url', c.logo_url,
            'wikidata_qid', c.wikidata_qid
          )
          FROM companies c
          WHERE c.id = co.parent_company_id
        )
      )
      FROM company_ownership co
      WHERE co.child_brand_id = p_brand_id
      ORDER BY co.confidence DESC
      LIMIT 1
    ),
    'people', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'role', cp.role,
          'name', cp.person_name,
          'image_url', cp.image_url,
          'source', cp.source
        ) ORDER BY 
          CASE cp.role
            WHEN 'chief_executive_officer' THEN 1
            WHEN 'chairperson' THEN 2
            WHEN 'founder' THEN 3
            ELSE 4
          END
      )
      FROM company_people cp
      WHERE cp.company_id = (
        SELECT parent_company_id 
        FROM company_ownership
        WHERE child_brand_id = p_brand_id
        ORDER BY confidence DESC
        LIMIT 1
      )
    ),
    'valuation', (
      SELECT jsonb_build_object(
        'metric', cv.metric,
        'value', cv.value_numeric,
        'currency', cv.currency,
        'as_of_date', cv.as_of_date,
        'source', cv.source
      )
      FROM company_valuation cv
      WHERE cv.company_id = (
        SELECT parent_company_id 
        FROM company_ownership
        WHERE child_brand_id = p_brand_id
        ORDER BY confidence DESC
        LIMIT 1
      )
      ORDER BY cv.as_of_date DESC
      LIMIT 1
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;