
-- Add support for diverse ownership structures beyond just institutional shareholders

-- Add ownership_structure column to companies table to store special ownership types
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS ownership_structure jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN companies.ownership_structure IS 'Stores special ownership info like employee-owned, family stakes, private equity, etc. Format: {"type": "employee_owned", "employee_percent": 80, "family_stakes": [{"name": "Jenkins family", "percent": 20}], "details": "Founded in 1930...", "source": "wikipedia"}';

-- Create a more flexible shareholders table that can handle different ownership types
CREATE TABLE IF NOT EXISTS company_ownership_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  owner_type text NOT NULL, -- 'employee', 'family', 'private_equity', 'founder', 'institutional', 'government', 'public_float'
  owner_name text, -- e.g., "Jenkins family", "Employees", "Sequoia Capital"
  percent_owned numeric CHECK (percent_owned >= 0 AND percent_owned <= 100),
  description text, -- Additional context about this ownership stake
  as_of date,
  source text NOT NULL, -- 'wikidata', 'wikipedia', 'sec', 'company_filing', etc.
  source_url text,
  confidence numeric DEFAULT 0.8,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_company_ownership_details_company ON company_ownership_details(company_id);
CREATE INDEX idx_company_ownership_details_type ON company_ownership_details(owner_type);

-- Enable RLS
ALTER TABLE company_ownership_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read company_ownership_details"
ON company_ownership_details FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Service role write company_ownership_details"
ON company_ownership_details FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Insert Publix ownership structure
DO $$
DECLARE
  v_publix_brand_id uuid;
  v_publix_company_id uuid;
BEGIN
  -- Get Publix brand ID
  SELECT id INTO v_publix_brand_id
  FROM brands 
  WHERE name ILIKE '%publix%'
  LIMIT 1;

  -- Get or create Publix company
  INSERT INTO companies (
    name,
    wikidata_qid,
    description,
    is_public,
    country,
    ownership_structure
  ) VALUES (
    'Publix Super Markets, Inc.',
    'Q1815006',
    'Employee-owned American supermarket chain headquartered in Lakeland, Florida. Founded in 1930 by George W. Jenkins.',
    false,
    'United States',
    jsonb_build_object(
      'type', 'employee_owned',
      'is_largest_esop', true,
      'employee_percent', 80,
      'details', 'Largest employee-owned company in the United States. Wholly owned by present and past employees and members of the Jenkins family.',
      'source', 'wikipedia'
    )
  )
  ON CONFLICT (wikidata_qid) 
  DO UPDATE SET
    ownership_structure = EXCLUDED.ownership_structure,
    description = EXCLUDED.description,
    is_public = EXCLUDED.is_public,
    country = EXCLUDED.country
  RETURNING id INTO v_publix_company_id;

  -- Link brand to company if we have both
  IF v_publix_brand_id IS NOT NULL AND v_publix_company_id IS NOT NULL THEN
    INSERT INTO company_ownership (
      child_brand_id,
      parent_company_id,
      parent_name,
      relationship,
      relationship_type,
      source,
      confidence
    ) VALUES (
      v_publix_brand_id,
      v_publix_company_id,
      'Publix Super Markets, Inc.',
      'subsidiary',
      'control',
      'wikipedia',
      0.95
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Insert ownership details
  IF v_publix_company_id IS NOT NULL THEN
    -- Employee ownership
    INSERT INTO company_ownership_details (
      company_id,
      owner_type,
      owner_name,
      percent_owned,
      description,
      source,
      source_url,
      confidence
    ) VALUES (
      v_publix_company_id,
      'employee',
      'Present and past employees',
      80.0,
      'Employee Stock Ownership Plan (ESOP). Publix is the largest employee-owned company in the United States.',
      'wikipedia',
      'https://en.wikipedia.org/wiki/Publix',
      0.95
    )
    ON CONFLICT DO NOTHING;

    -- Family ownership
    INSERT INTO company_ownership_details (
      company_id,
      owner_type,
      owner_name,
      percent_owned,
      description,
      source,
      source_url,
      confidence
    ) VALUES (
      v_publix_company_id,
      'family',
      'Jenkins family',
      20.0,
      'Descendants of founder George W. Jenkins who founded the company in 1930.',
      'wikipedia',
      'https://en.wikipedia.org/wiki/Publix',
      0.95
    );
  END IF;
END $$;
