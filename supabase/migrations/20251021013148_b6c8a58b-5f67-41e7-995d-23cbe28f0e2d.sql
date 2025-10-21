-- Ownership & Key People Enrichment

-- Companies table (parent organizations)
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  wikidata_qid text UNIQUE,
  wikipedia_title text,
  ticker text,
  exchange text,
  is_public boolean DEFAULT false,
  country text,
  description text,
  description_source text,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Who owns whom
CREATE TABLE IF NOT EXISTS company_ownership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  parent_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  parent_name text NOT NULL,
  relationship text,
  source text NOT NULL,
  source_ref text,
  confidence numeric DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  last_verified_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(child_brand_id, parent_name)
);

-- Key people (CEO, Chair, Founders)
CREATE TABLE IF NOT EXISTS company_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role text NOT NULL,
  person_name text NOT NULL,
  person_qid text,
  image_url text,
  source text NOT NULL,
  source_ref text,
  last_verified_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, role, person_name)
);

-- Valuation / market cap snapshots
CREATE TABLE IF NOT EXISTS company_valuation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  metric text NOT NULL CHECK (metric IN ('market_cap', 'valuation', 'revenue')),
  currency text NOT NULL DEFAULT 'USD',
  value_numeric numeric,
  as_of_date date NOT NULL,
  source text NOT NULL,
  source_ref text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_ownership_brand ON company_ownership(child_brand_id);
CREATE INDEX IF NOT EXISTS idx_company_ownership_parent ON company_ownership(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_company_people_company ON company_people(company_id);
CREATE INDEX IF NOT EXISTS idx_company_valuation_company ON company_valuation(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_qid ON companies(wikidata_qid) WHERE wikidata_qid IS NOT NULL;

-- RLS policies
ALTER TABLE company_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_valuation ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read company_ownership" ON company_ownership FOR SELECT USING (true);
CREATE POLICY "Public read companies" ON companies FOR SELECT USING (true);
CREATE POLICY "Public read company_people" ON company_people FOR SELECT USING (true);
CREATE POLICY "Public read company_valuation" ON company_valuation FOR SELECT USING (true);

-- Admin write access
CREATE POLICY "Admin write company_ownership" ON company_ownership FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admin write companies" ON companies FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admin write company_people" ON company_people FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admin write company_valuation" ON company_valuation FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Service role write access
CREATE POLICY "Service role write company_ownership" ON company_ownership FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role write companies" ON companies FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role write company_people" ON company_people FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role write company_valuation" ON company_valuation FOR INSERT
  WITH CHECK (true);

-- Helper function to get enriched company data for a brand
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
      SELECT jsonb_agg(
        jsonb_build_object(
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