-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_people_company ON company_people(company_id);
CREATE INDEX IF NOT EXISTS idx_company_ownership_child ON company_ownership(child_brand_id);
CREATE INDEX IF NOT EXISTS idx_company_shareholders_company ON company_shareholders(company_id);

-- Add constraint on percent_owned (using actual column name)
ALTER TABLE company_shareholders
  DROP CONSTRAINT IF EXISTS company_shareholders_pct_chk;

ALTER TABLE company_shareholders
  ADD CONSTRAINT company_shareholders_pct_chk 
  CHECK (percent_owned >= 0 AND percent_owned <= 100);