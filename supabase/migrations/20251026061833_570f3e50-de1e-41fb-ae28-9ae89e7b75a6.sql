-- STEP 2: Clean Up Bad Placeholders
-- Remove placeholder shareholders from private companies and private equity firms

DELETE FROM company_shareholders
WHERE source = 'placeholder' 
AND pct = 0
AND company_id IN (
  SELECT id FROM companies 
  WHERE is_public = false 
  OR name ILIKE '%private equity%'
  OR name ILIKE '%capital management%'
  OR name ILIKE '%privately held%'
  OR name ILIKE '%investment%'
);