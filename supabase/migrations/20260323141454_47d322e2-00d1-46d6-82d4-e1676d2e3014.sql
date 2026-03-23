-- Add SEC refresh tracking to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_sec_refresh timestamptz;

-- Add key_people table for executives from SEC filings
CREATE TABLE IF NOT EXISTS company_key_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  title text,
  source text DEFAULT 'sec_edgar',
  source_url text,
  is_current boolean DEFAULT true,
  effective_from date,
  effective_to date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, name, title)
);

ALTER TABLE company_key_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read key people" ON company_key_people FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_company_key_people_company ON company_key_people(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_sec_cik_lookup ON companies(sec_cik) WHERE sec_cik IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_last_sec_refresh ON companies(last_sec_refresh);