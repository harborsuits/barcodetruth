-- Create Keurig Dr Pepper as a company (parent of Dr Pepper brand)
INSERT INTO companies (name, ticker, exchange, is_public, country, wikidata_qid)
VALUES ('Keurig Dr Pepper', 'KDP', 'NASDAQ', true, 'United States', 'Q29514595')
ON CONFLICT (wikidata_qid) DO UPDATE SET ticker = 'KDP', is_public = true;

-- Set up parent relationship for Dr Pepper → Keurig Dr Pepper
WITH kdp AS (
  SELECT id FROM companies WHERE ticker = 'KDP' LIMIT 1
)
INSERT INTO company_ownership (
  child_brand_id,
  parent_company_id,
  parent_name,
  relationship,
  confidence,
  source
)
SELECT 
  '2f823b24-9d0c-4a0c-8a3b-d99ed3661cea',
  kdp.id,
  'Keurig Dr Pepper',
  'parent_organization',
  0.95,
  'wikidata'
FROM kdp
ON CONFLICT DO NOTHING;