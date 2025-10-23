-- Standardize shareholders column to pct everywhere
ALTER TABLE company_shareholders 
  RENAME COLUMN percent_owned TO pct;

-- Update constraint to use new column name
ALTER TABLE company_shareholders
  DROP CONSTRAINT IF EXISTS company_shareholders_pct_chk;

ALTER TABLE company_shareholders
  ADD CONSTRAINT company_shareholders_pct_chk 
  CHECK (pct >= 0 AND pct <= 100);