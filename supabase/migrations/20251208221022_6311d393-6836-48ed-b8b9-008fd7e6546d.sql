-- Create table for SEC 13F institutional holders data
CREATE TABLE IF NOT EXISTS public.company_institutional_holders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cik text,
  holder_name text NOT NULL,
  shares numeric,
  position_value numeric,
  percent_outstanding numeric,
  reported_at date,
  source text NOT NULL DEFAULT 'fmp_13f',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for lookups by company
CREATE INDEX IF NOT EXISTS idx_company_institutional_holders_company
  ON company_institutional_holders(company_id);

-- Enable RLS
ALTER TABLE company_institutional_holders ENABLE ROW LEVEL SECURITY;

-- Public read access (this is public financial data)
CREATE POLICY "Anyone can read institutional holders"
  ON company_institutional_holders FOR SELECT
  USING (true);

-- Service role can manage
CREATE POLICY "Service role can manage institutional holders"
  ON company_institutional_holders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);