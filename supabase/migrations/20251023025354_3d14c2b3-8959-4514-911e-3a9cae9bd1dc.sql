-- ============================================
-- BRAND PROFILE UNIFORMITY SYSTEM
-- ============================================
-- Creates resolver views and RPCs that ensure all brands show
-- consistent features (people, shareholders) with parent fallbacks

-- ============================================
-- 1. KEY PEOPLE RESOLVER VIEW
-- ============================================
-- Resolution order:
-- 1) company_people (enriched data)
-- 2) parent company_people (fallback to parent)
-- 3) Always returns empty set (never null) for consistent UI

CREATE OR REPLACE VIEW v_company_people_resolved AS
WITH direct_people AS (
  -- Direct company people (priority 1)
  SELECT
    c.id as company_id,
    cp.id as person_id,
    cp.person_name as full_name,
    cp.role,
    cp.image_url,
    cp.wikipedia_url,
    cp.person_qid,
    cp.source_name as source,
    cp.last_verified_at as last_updated,
    1 as priority
  FROM companies c
  JOIN company_people cp ON cp.company_id = c.id
),
parent_people AS (
  -- Parent company people (priority 2)
  SELECT
    c.id as company_id,
    cp.id as person_id,
    cp.person_name as full_name,
    cp.role,
    cp.image_url,
    cp.wikipedia_url,
    cp.person_qid,
    cp.source_name as source,
    cp.last_verified_at as last_updated,
    2 as priority
  FROM companies c
  JOIN company_ownership co ON co.child_brand_id IS NOT NULL -- brands linked to companies
    AND co.parent_company_id = c.id
    AND co.relationship_type = 'control'
  JOIN company_people cp ON cp.company_id = c.id
),
brand_via_ownership AS (
  -- For brands that have parent companies
  SELECT
    co.child_brand_id as brand_id,
    co.parent_company_id as company_id
  FROM company_ownership co
  WHERE co.child_brand_id IS NOT NULL
    AND co.relationship_type = 'control'
  ORDER BY co.confidence DESC
  LIMIT 1 -- One parent per brand
),
parent_people_for_brands AS (
  -- Parent company people via brand ownership (priority 2)
  SELECT
    bvo.brand_id as company_id,
    cp.id as person_id,
    cp.person_name as full_name,
    cp.role,
    cp.image_url,
    cp.wikipedia_url,
    cp.person_qid,
    cp.source_name as source,
    cp.last_verified_at as last_updated,
    2 as priority
  FROM brand_via_ownership bvo
  JOIN company_people cp ON cp.company_id = bvo.company_id
),
combined AS (
  SELECT * FROM direct_people
  UNION ALL
  SELECT * FROM parent_people_for_brands
)
SELECT DISTINCT ON (company_id, person_id)
  company_id,
  person_id,
  full_name,
  role,
  image_url,
  wikipedia_url,
  person_qid,
  source,
  last_updated,
  priority
FROM combined
ORDER BY company_id, person_id, priority ASC, last_updated DESC NULLS LAST;

-- ============================================
-- 2. SHAREHOLDERS RESOLVER VIEW
-- ============================================
-- Resolution order:
-- 1) company_shareholders (enriched data)
-- 2) parent company_shareholders
-- 3) company_ownership_details (fallback)
-- 4) parent company_ownership_details

CREATE OR REPLACE VIEW v_company_shareholders_resolved AS
WITH enriched_direct AS (
  -- Direct company shareholders (priority 1)
  SELECT
    c.id as company_id,
    cs.id as shareholder_id,
    cs.holder_name,
    cs.holder_type,
    cs.pct as percent_owned,
    cs.as_of,
    cs.source_name as source,
    cs.created_at as last_updated,
    cs.is_asset_manager,
    cs.holder_wikidata_qid,
    cs.wikipedia_url,
    cs.holder_url,
    1 as priority
  FROM companies c
  JOIN company_shareholders cs ON cs.company_id = c.id
),
enriched_parent AS (
  -- Parent company shareholders (priority 2)
  SELECT
    c.id as company_id,
    cs.id as shareholder_id,
    cs.holder_name,
    cs.holder_type,
    cs.pct as percent_owned,
    cs.as_of,
    cs.source_name as source,
    cs.created_at as last_updated,
    cs.is_asset_manager,
    cs.holder_wikidata_qid,
    cs.wikipedia_url,
    cs.holder_url,
    2 as priority
  FROM companies c
  JOIN company_ownership co ON co.child_brand_id IS NOT NULL
    AND co.parent_company_id = c.id
    AND co.relationship_type = 'control'
  JOIN company_shareholders cs ON cs.company_id = c.id
),
brand_parent_shareholders AS (
  -- For brands with parent companies (priority 2)
  SELECT
    co.child_brand_id as company_id,
    cs.id as shareholder_id,
    cs.holder_name,
    cs.holder_type,
    cs.pct as percent_owned,
    cs.as_of,
    cs.source_name as source,
    cs.created_at as last_updated,
    cs.is_asset_manager,
    cs.holder_wikidata_qid,
    cs.wikipedia_url,
    cs.holder_url,
    2 as priority
  FROM company_ownership co
  JOIN company_shareholders cs ON cs.company_id = co.parent_company_id
  WHERE co.child_brand_id IS NOT NULL
    AND co.relationship_type = 'control'
),
ownership_details_direct AS (
  -- company_ownership_details fallback (priority 3)
  SELECT
    c.id as company_id,
    cod.id as shareholder_id,
    cod.owner_name as holder_name,
    cod.owner_type as holder_type,
    cod.percent_owned,
    cod.as_of,
    cod.source,
    cod.updated_at as last_updated,
    (cod.owner_type = 'asset_manager')::boolean as is_asset_manager,
    NULL::text as holder_wikidata_qid,
    NULL::text as wikipedia_url,
    cod.source_url as holder_url,
    3 as priority
  FROM companies c
  JOIN company_ownership_details cod ON cod.company_id = c.id
  WHERE cod.owner_type IN ('institutional_investor', 'asset_manager', 'corporation')
    AND cod.percent_owned IS NOT NULL
),
ownership_details_parent AS (
  -- Parent company_ownership_details fallback (priority 4)
  SELECT
    co.child_brand_id as company_id,
    cod.id as shareholder_id,
    cod.owner_name as holder_name,
    cod.owner_type as holder_type,
    cod.percent_owned,
    cod.as_of,
    cod.source,
    cod.updated_at as last_updated,
    (cod.owner_type = 'asset_manager')::boolean as is_asset_manager,
    NULL::text as holder_wikidata_qid,
    NULL::text as wikipedia_url,
    cod.source_url as holder_url,
    4 as priority
  FROM company_ownership co
  JOIN company_ownership_details cod ON cod.company_id = co.parent_company_id
  WHERE co.child_brand_id IS NOT NULL
    AND co.relationship_type = 'control'
    AND cod.owner_type IN ('institutional_investor', 'asset_manager', 'corporation')
    AND cod.percent_owned IS NOT NULL
),
combined AS (
  SELECT * FROM enriched_direct
  UNION ALL
  SELECT * FROM brand_parent_shareholders
  UNION ALL
  SELECT * FROM ownership_details_direct
  UNION ALL
  SELECT * FROM ownership_details_parent
)
SELECT DISTINCT ON (company_id, holder_name)
  company_id,
  shareholder_id,
  holder_name,
  holder_type,
  percent_owned,
  as_of,
  source,
  last_updated,
  is_asset_manager,
  holder_wikidata_qid,
  wikipedia_url,
  holder_url,
  priority
FROM combined
ORDER BY company_id, holder_name, priority ASC, last_updated DESC NULLS LAST;

-- ============================================
-- 3. STABLE RPC CONTRACTS
-- ============================================

-- Get key people for a brand or company
CREATE OR REPLACE FUNCTION rpc_get_key_people(entity_id uuid)
RETURNS TABLE (
  person_id uuid,
  full_name text,
  role text,
  image_url text,
  wikipedia_url text,
  person_qid text,
  source text,
  last_updated timestamptz,
  data_source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    person_id,
    full_name,
    role,
    image_url,
    wikipedia_url,
    person_qid,
    source,
    last_updated,
    CASE priority
      WHEN 1 THEN 'direct'
      WHEN 2 THEN 'parent'
      ELSE 'unknown'
    END as data_source
  FROM v_company_people_resolved
  WHERE company_id = entity_id
  ORDER BY 
    CASE role
      WHEN 'chief_executive_officer' THEN 1
      WHEN 'chairperson' THEN 2
      WHEN 'founder' THEN 3
      ELSE 4
    END,
    full_name ASC;
$$;

-- Get top shareholders for a brand or company
CREATE OR REPLACE FUNCTION rpc_get_top_shareholders(
  entity_id uuid,
  result_limit integer DEFAULT 10
)
RETURNS TABLE (
  shareholder_id uuid,
  holder_name text,
  holder_type text,
  percent_owned numeric,
  as_of date,
  source text,
  last_updated timestamptz,
  is_asset_manager boolean,
  holder_wikidata_qid text,
  wikipedia_url text,
  holder_url text,
  data_source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    shareholder_id,
    holder_name,
    holder_type,
    percent_owned,
    as_of,
    source,
    last_updated,
    is_asset_manager,
    holder_wikidata_qid,
    wikipedia_url,
    holder_url,
    CASE priority
      WHEN 1 THEN 'direct'
      WHEN 2 THEN 'parent'
      WHEN 3 THEN 'details_direct'
      WHEN 4 THEN 'details_parent'
      ELSE 'unknown'
    END as data_source
  FROM v_company_shareholders_resolved
  WHERE company_id = entity_id
  ORDER BY percent_owned DESC NULLS LAST, holder_name ASC
  LIMIT result_limit;
$$;

-- ============================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_company_people_company_id 
  ON company_people(company_id);

CREATE INDEX IF NOT EXISTS idx_company_shareholders_company_id 
  ON company_shareholders(company_id);

CREATE INDEX IF NOT EXISTS idx_company_ownership_details_company_id 
  ON company_ownership_details(company_id);

CREATE INDEX IF NOT EXISTS idx_company_ownership_child_brand_relationship 
  ON company_ownership(child_brand_id, relationship_type)
  WHERE relationship_type = 'control';

-- ============================================
-- 5. COMMENTS
-- ============================================

COMMENT ON VIEW v_company_people_resolved IS 'Resolves key people with parent fallback. Always returns empty set (never null) for uniform UI.';
COMMENT ON VIEW v_company_shareholders_resolved IS 'Resolves shareholders with parent and ownership_details fallback. Returns empty set when no data.';
COMMENT ON FUNCTION rpc_get_key_people IS 'Stable contract for fetching key people. Returns empty array when no data available.';
COMMENT ON FUNCTION rpc_get_top_shareholders IS 'Stable contract for fetching shareholders. Returns empty array when no data available.';