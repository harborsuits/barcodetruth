-- Fix Key People resolution with better fallback logic and company resolver
-- This migration improves the RPC function to ensure key people are found

-- Drop and recreate with improved logic
DROP FUNCTION IF EXISTS public.rpc_get_key_people(uuid);

CREATE OR REPLACE FUNCTION public.rpc_get_key_people(p_brand_id uuid)
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
DECLARE
  v_company_id uuid;
  v_brand_qid text;
BEGIN
  -- Strategy 1: Direct parent company link via company_ownership
  SELECT co.parent_company_id INTO v_company_id
  FROM public.company_ownership co
  WHERE co.child_brand_id = p_brand_id
    AND co.parent_company_id IS NOT NULL
  LIMIT 1;

  -- If found, return people from this company
  IF v_company_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      cp.person_qid,
      cp.person_name,
      coalesce(cp.role, 'unknown') as role,
      null::text as title,
      null::text as seniority,
      null::date as start_date,
      null::date as end_date,
      coalesce(cp.source_name, cp.source) as source,
      coalesce(cp.last_verified_at, cp.created_at) as last_updated,
      cp.image_url
    FROM public.company_people cp
    WHERE cp.company_id = v_company_id
    ORDER BY
      CASE lower(coalesce(cp.role, ''))
        WHEN 'chief_executive_officer' THEN 1
        WHEN 'ceo' THEN 1
        WHEN 'chairperson' THEN 2
        WHEN 'founder' THEN 3
        ELSE 4
      END,
      cp.person_name;
    RETURN;
  END IF;

  -- Strategy 2: Brand has same Wikidata QID as a company
  SELECT b.wikidata_qid INTO v_brand_qid
  FROM public.brands b
  WHERE b.id = p_brand_id
    AND b.wikidata_qid IS NOT NULL;

  IF v_brand_qid IS NOT NULL THEN
    SELECT c.id INTO v_company_id
    FROM public.companies c
    WHERE c.wikidata_qid = v_brand_qid
    LIMIT 1;

    IF v_company_id IS NOT NULL THEN
      RETURN QUERY
      SELECT
        cp.person_qid,
        cp.person_name,
        coalesce(cp.role, 'unknown') as role,
        null::text as title,
        null::text as seniority,
        null::date as start_date,
        null::date as end_date,
        coalesce(cp.source_name, cp.source) as source,
        coalesce(cp.last_verified_at, cp.created_at) as last_updated,
        cp.image_url
      FROM public.company_people cp
      WHERE cp.company_id = v_company_id
      ORDER BY
        CASE lower(coalesce(cp.role, ''))
          WHEN 'chief_executive_officer' THEN 1
          WHEN 'ceo' THEN 1
          WHEN 'chairperson' THEN 2
          WHEN 'founder' THEN 3
          ELSE 4
        END,
        cp.person_name;
      RETURN;
    END IF;
  END IF;

  -- Strategy 3: Brand→Wikidata mapping via brand_data_mappings
  SELECT c.id INTO v_company_id
  FROM public.brand_data_mappings bdm
  JOIN public.companies c ON c.wikidata_qid = bdm.external_id
  WHERE bdm.brand_id = p_brand_id
    AND bdm.source = 'wikidata'
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      cp.person_qid,
      cp.person_name,
      coalesce(cp.role, 'unknown') as role,
      null::text as title,
      null::text as seniority,
      null::date as start_date,
      null::date as end_date,
      coalesce(cp.source_name, cp.source) as source,
      coalesce(cp.last_verified_at, cp.created_at) as last_updated,
      cp.image_url
    FROM public.company_people cp
    WHERE cp.company_id = v_company_id
    ORDER BY
      CASE lower(coalesce(cp.role, ''))
        WHEN 'chief_executive_officer' THEN 1
        WHEN 'ceo' THEN 1
        WHEN 'chairperson' THEN 2
        WHEN 'founder' THEN 3
        ELSE 4
      END,
      cp.person_name;
    RETURN;
  END IF;

  -- No company found - return empty set (not null)
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_key_people(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.rpc_get_key_people IS 'Returns key people for a brand with robust company resolution. Returns empty array when no data available.';