-- Drop old RPC functions and views
DROP FUNCTION IF EXISTS rpc_get_key_people(uuid);
DROP FUNCTION IF EXISTS rpc_get_top_shareholders(uuid, int);
DROP VIEW IF EXISTS v_company_people_resolved;
DROP VIEW IF EXISTS v_company_shareholders_resolved;

-- Self-contained RPC: Get key people with robust company resolver
CREATE OR REPLACE FUNCTION rpc_get_key_people(p_brand_id uuid)
RETURNS TABLE (
  person_qid text,
  person_name text,
  role text,
  title text,
  seniority text,
  start_date date,
  end_date date,
  source text,
  last_updated timestamptz,
  image_url text
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH company_choice AS (
    -- Preferred: direct parent company link
    SELECT co.parent_company_id as company_id, 1 as pref
    FROM company_ownership co
    WHERE co.child_brand_id = p_brand_id
    UNION ALL
    -- Fallback 1: Wikidata mapping
    SELECT c.id, 2
    FROM brand_data_mappings bdm
    JOIN companies c ON c.wikidata_qid = bdm.external_id
    WHERE bdm.brand_id = p_brand_id
      AND bdm.source = 'wikidata'
    UNION ALL
    -- Fallback 2: Direct QID match
    SELECT c2.id, 3
    FROM brands b
    JOIN companies c2 ON c2.wikidata_qid = b.wikidata_qid
    WHERE b.id = p_brand_id
  ),
  chosen AS (
    SELECT company_id
    FROM company_choice
    WHERE company_id IS NOT NULL
    ORDER BY pref ASC
    LIMIT 1
  )
  SELECT
    cp.person_qid,
    cp.person_name,
    COALESCE(cp.role, cp.title) as role,
    cp.title,
    cp.seniority,
    cp.start_date,
    cp.end_date,
    cp.source,
    cp.last_verified_at as last_updated,
    cp.image_url
  FROM chosen ch
  JOIN company_people cp ON cp.company_id = ch.company_id
  ORDER BY
    CASE LOWER(COALESCE(cp.role, ''))
      WHEN 'chief_executive_officer' THEN 1
      WHEN 'ceo' THEN 1
      WHEN 'chairperson' THEN 2
      WHEN 'founder' THEN 3
      ELSE 4
    END,
    cp.person_name;
END;
$$;

-- Self-contained RPC: Get top shareholders with dual source fallback
CREATE OR REPLACE FUNCTION rpc_get_top_shareholders(p_brand_id uuid, p_limit int DEFAULT 10)
RETURNS TABLE (
  holder_name text,
  holder_type text,
  percent_owned numeric,
  shares_owned bigint,
  as_of date,
  source text,
  last_updated timestamptz,
  is_asset_manager boolean,
  holder_wikidata_qid text,
  wikipedia_url text,
  holder_url text,
  data_source text
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH company_choice AS (
    -- Preferred: direct parent company link
    SELECT co.parent_company_id as company_id, 1 as pref
    FROM company_ownership co
    WHERE co.child_brand_id = p_brand_id
    UNION ALL
    -- Fallback 1: Wikidata mapping
    SELECT c.id, 2
    FROM brand_data_mappings bdm
    JOIN companies c ON c.wikidata_qid = bdm.external_id
    WHERE bdm.brand_id = p_brand_id
      AND bdm.source = 'wikidata'
    UNION ALL
    -- Fallback 2: Direct QID match
    SELECT c2.id, 3
    FROM brands b
    JOIN companies c2 ON c2.wikidata_qid = b.wikidata_qid
    WHERE b.id = p_brand_id
  ),
  chosen AS (
    SELECT company_id
    FROM company_choice
    WHERE company_id IS NOT NULL
    ORDER BY pref ASC
    LIMIT 1
  ),
  from_enriched AS (
    SELECT
      cs.holder_name,
      cs.holder_type,
      cs.pct as percent_owned,
      NULL::bigint as shares_owned,
      cs.as_of as as_of,
      cs.source,
      cs.created_at as last_updated,
      COALESCE(cs.is_asset_manager, false) as is_asset_manager,
      cs.holder_wikidata_qid,
      cs.wikipedia_url,
      cs.holder_url,
      'company_shareholders'::text as data_source
    FROM chosen ch
    JOIN company_shareholders cs ON cs.company_id = ch.company_id
  ),
  from_fallback AS (
    SELECT
      cod.owner_name as holder_name,
      cod.owner_type as holder_type,
      cod.percent_owned,
      NULL::bigint as shares_owned,
      cod.as_of as as_of,
      cod.source,
      cod.updated_at as last_updated,
      false as is_asset_manager,
      NULL::text as holder_wikidata_qid,
      NULL::text as wikipedia_url,
      NULL::text as holder_url,
      'company_ownership_details'::text as data_source
    FROM chosen ch
    JOIN company_ownership_details cod ON cod.company_id = ch.company_id
  ),
  unioned AS (
    SELECT * FROM from_enriched
    UNION ALL
    SELECT * FROM from_fallback
  )
  SELECT *
  FROM unioned
  ORDER BY percent_owned DESC NULLS LAST, holder_name ASC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION rpc_get_key_people(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_get_top_shareholders(uuid, int) TO anon, authenticated;