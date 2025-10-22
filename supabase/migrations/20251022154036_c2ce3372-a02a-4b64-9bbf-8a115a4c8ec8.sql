-- Fix: Remove the ORDER BY inside the aggregation subquery
CREATE OR REPLACE FUNCTION public.get_brand_ownership(p_brand_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_company_id uuid;
  v_result jsonb;
  v_control_chain jsonb;
  v_siblings jsonb;
  v_shareholder_data jsonb;
  v_latest_date date;
BEGIN
  -- Step 1: Find the parent company from company_ownership
  SELECT parent_company_id INTO v_company_id
  FROM company_ownership
  WHERE child_brand_id = p_brand_id
    AND relationship IN ('parent', 'parent_organization', 'subsidiary', 'owned_by')
    AND confidence >= 0.7
  ORDER BY confidence DESC
  LIMIT 1;

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

  -- Step 3: If no cache, build structure from scratch
  IF v_control_chain IS NULL THEN
    -- Start with the brand
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
    
    -- Add parent company if found
    IF v_company_id IS NOT NULL THEN
      SELECT v_control_chain || jsonb_build_array(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'type', 'company',
          'is_public', c.is_public,
          'ticker', c.ticker,
          'exchange', c.exchange,
          'relation', co.relationship,
          'source', co.source,
          'confidence', co.confidence
        )
      ) INTO v_control_chain
      FROM companies c
      JOIN company_ownership co ON co.parent_company_id = c.id
      WHERE c.id = v_company_id AND co.child_brand_id = p_brand_id;
    END IF;
    
    v_siblings := '[]'::jsonb;
  END IF;

  -- Step 4: Build shareholder data with links if not cached
  IF v_shareholder_data IS NULL OR v_shareholder_data = '{}'::jsonb THEN
    IF v_company_id IS NOT NULL THEN
      SELECT MAX(as_of) INTO v_latest_date
      FROM company_shareholders
      WHERE company_id = v_company_id;

      IF v_latest_date IS NOT NULL THEN
        v_shareholder_data := jsonb_build_object(
          'subject_company', (SELECT name FROM companies WHERE id = v_company_id),
          'as_of', v_latest_date,
          'buckets', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
              'key', holder_type,
              'percent', bucket_percent,
              'source_name', source_name,
              'source_url', source_url
            )), '[]'::jsonb)
            FROM (
              SELECT
                holder_type,
                SUM(percent_owned) as bucket_percent,
                MIN(source_name) as source_name,
                MIN(source_url) as source_url
              FROM company_shareholders
              WHERE company_id = v_company_id AND as_of = v_latest_date
              GROUP BY holder_type
            ) buckets
          ),
          'top', (
            SELECT COALESCE(jsonb_agg(holder_obj), '[]'::jsonb)
            FROM (
              SELECT jsonb_build_object(
                'name', holder_name,
                'type', holder_type,
                'percent', percent_owned,
                'url', COALESCE(holder_url, wikipedia_url),
                'official_url', holder_url,
                'wikipedia_url', wikipedia_url,
                'wikidata_qid', holder_wikidata_qid,
                'logo_url', logo_url,
                'source_name', source_name,
                'source_url', source_url
              ) as holder_obj
              FROM company_shareholders
              WHERE company_id = v_company_id AND as_of = v_latest_date
              ORDER BY percent_owned DESC
              LIMIT 10
            ) top_holders
          )
        );
      ELSE
        v_shareholder_data := '{}'::jsonb;
      END IF;
    ELSE
      v_shareholder_data := '{}'::jsonb;
    END IF;
  END IF;

  -- Step 5: Build result
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
$function$;

GRANT EXECUTE ON FUNCTION get_brand_ownership(uuid) TO anon, authenticated;