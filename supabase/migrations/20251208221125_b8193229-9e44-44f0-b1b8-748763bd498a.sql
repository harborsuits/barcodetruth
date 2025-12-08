-- Update get_shareholder_breakdown to prefer SEC 13F data when available
CREATE OR REPLACE FUNCTION public.get_shareholder_breakdown(p_brand_id uuid, p_max_items integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  parent_id uuid;
  parent_name text;
  top_items jsonb;
  sec_count integer;
  total_pct numeric;
  others_count integer;
BEGIN
  -- Get parent company for this brand
  SELECT c.id, c.name
  INTO parent_id, parent_name
  FROM company_ownership co
  JOIN companies c ON c.id = co.parent_company_id
  WHERE co.child_brand_id = p_brand_id
  ORDER BY co.confidence DESC
  LIMIT 1;

  IF parent_id IS NULL THEN
    RETURN jsonb_build_object(
      'company_id', NULL,
      'company_name', NULL,
      'items', '[]'::jsonb,
      'others', NULL
    );
  END IF;

  -- Check if we have SEC 13F data (preferred source)
  SELECT COUNT(*) INTO sec_count
  FROM company_institutional_holders
  WHERE company_id = parent_id;

  IF sec_count > 0 THEN
    -- Use SEC 13F data
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'holder_name', h.holder_name,
          'ownership_percentage', COALESCE(h.percent_outstanding, 0),
          'shares', h.shares,
          'position_value', h.position_value,
          'holder_wikidata_qid', NULL,
          'approx_brand_slug', NULL,
          'approx_brand_logo_url', NULL,
          'source', 'sec_13f'
        )
        ORDER BY COALESCE(h.percent_outstanding, 0) DESC, COALESCE(h.shares, 0) DESC, h.holder_name
      ),
      '[]'::jsonb
    )
    INTO top_items
    FROM (
      SELECT * FROM company_institutional_holders
      WHERE company_id = parent_id
      ORDER BY COALESCE(percent_outstanding, 0) DESC, COALESCE(shares, 0) DESC
      LIMIT p_max_items
    ) h;

    -- Calculate others
    SELECT 
      COALESCE(SUM(COALESCE(percent_outstanding, 0)), 0),
      COUNT(*)
    INTO total_pct, others_count
    FROM company_institutional_holders
    WHERE company_id = parent_id;

    RETURN jsonb_build_object(
      'company_id', parent_id,
      'company_name', parent_name,
      'items', top_items,
      'total_holders', others_count,
      'source', 'sec_13f',
      'others', CASE 
        WHEN others_count > p_max_items THEN 
          jsonb_build_object('count', others_count - p_max_items)
        ELSE NULL
      END
    );
  END IF;

  -- Fall back to company_shareholders (Wikidata source)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'holder_name', sh.holder_name,
        'ownership_percentage', COALESCE(sh.percent_owned, 0),
        'shares', NULL,
        'position_value', NULL,
        'holder_wikidata_qid', sh.holder_wikidata_qid,
        'approx_brand_slug', ab.slug,
        'approx_brand_logo_url', ab.logo_url,
        'source', 'wikidata'
      )
      ORDER BY COALESCE(sh.percent_owned, 0) DESC, sh.holder_name
    ),
    '[]'::jsonb
  )
  INTO top_items
  FROM (
    SELECT * FROM company_shareholders
    WHERE company_id = parent_id
    ORDER BY COALESCE(percent_owned, 0) DESC
    LIMIT p_max_items
  ) sh
  LEFT JOIN brands ab ON ab.wikidata_qid = sh.holder_wikidata_qid;

  -- Calculate others for Wikidata source
  SELECT COUNT(*) INTO others_count
  FROM company_shareholders
  WHERE company_id = parent_id;

  RETURN jsonb_build_object(
    'company_id', parent_id,
    'company_name', parent_name,
    'items', top_items,
    'total_holders', others_count,
    'source', 'wikidata',
    'others', CASE 
      WHEN others_count > p_max_items THEN 
        jsonb_build_object('count', others_count - p_max_items)
      ELSE NULL
    END
  );
END;
$function$;