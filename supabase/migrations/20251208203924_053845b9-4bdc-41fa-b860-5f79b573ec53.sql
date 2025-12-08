-- Shareholder breakdown for a brand's parent company
CREATE OR REPLACE FUNCTION get_shareholder_breakdown(
  p_brand_id uuid,
  p_max_items int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_id uuid;
  parent_name text;
  top_items jsonb;
  others_pct numeric;
  total_pct numeric;
BEGIN
  -- Find parent company for this brand
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

  SELECT COALESCE(SUM(percent_owned), 0)
  INTO total_pct
  FROM company_shareholders
  WHERE company_id = parent_id;

  IF total_pct = 0 THEN
    RETURN jsonb_build_object(
      'company_id', parent_id,
      'company_name', parent_name,
      'items', '[]'::jsonb,
      'others', NULL
    );
  END IF;

  -- Top N holders, map to brands when possible
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'holder_name', s.holder_name,
        'ownership_percentage', s.percent_owned,
        'holder_wikidata_qid', s.holder_wikidata_qid,
        'approx_brand_slug', b.slug,
        'approx_brand_logo_url', b.logo_url
      )
      ORDER BY s.percent_owned DESC
    ),
    '[]'::jsonb
  )
  INTO top_items
  FROM (
    SELECT *
    FROM company_shareholders
    WHERE company_id = parent_id
    ORDER BY percent_owned DESC
    LIMIT p_max_items
  ) s
  LEFT JOIN brands b
    ON b.wikidata_qid = s.holder_wikidata_qid;

  SELECT COALESCE(SUM((elem->>'ownership_percentage')::numeric), 0)
  INTO others_pct
  FROM jsonb_array_elements(top_items) elem;

  others_pct := GREATEST(total_pct - others_pct, 0);

  RETURN jsonb_build_object(
    'company_id', parent_id,
    'company_name', parent_name,
    'items', top_items,
    'others', CASE WHEN others_pct > 0 THEN others_pct ELSE NULL END
  );
END;
$$;

-- Key figures for a brand's parent company
CREATE OR REPLACE FUNCTION get_key_people_for_brand(p_brand_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_id uuid;
  parent_name text;
  people jsonb;
BEGIN
  SELECT c.id, c.name
  INTO parent_id, parent_name
  FROM company_ownership co
  JOIN companies c ON c.id = co.parent_company_id
  WHERE co.child_brand_id = p_brand_id
  ORDER BY co.confidence DESC
  LIMIT 1;

  IF parent_id IS NULL THEN
    RETURN jsonb_build_object('company_id', NULL, 'company_name', NULL, 'people', '[]'::jsonb);
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', p.person_name,
        'position', p.role,
        'wikidata_qid', p.person_qid,
        'image_url', p.image_url
      )
      ORDER BY
        CASE
          WHEN lower(p.role) LIKE '%ceo%' THEN 0
          WHEN lower(p.role) LIKE '%chief executive%' THEN 0
          WHEN lower(p.role) LIKE '%chair%' THEN 1
          ELSE 2
        END,
        p.person_name
    ),
    '[]'::jsonb
  )
  INTO people
  FROM company_people p
  WHERE p.company_id = parent_id;

  RETURN jsonb_build_object('company_id', parent_id, 'company_name', parent_name, 'people', people);
END;
$$;