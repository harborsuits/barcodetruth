-- First: Update existing companies that match brand names with wikidata_qid
UPDATE companies c
SET wikidata_qid = b.wikidata_qid
FROM brands b
WHERE LOWER(c.name) = LOWER(b.name)
  AND b.wikidata_qid IS NOT NULL
  AND c.wikidata_qid IS NULL;

-- Second: For brands with no matching company, create new ones
-- Use a unique suffix for name conflicts
INSERT INTO companies (name, ticker, wikidata_qid, is_public, country)
SELECT 
  b.name,
  b.ticker,
  b.wikidata_qid,
  CASE WHEN b.company_type = 'public' THEN true ELSE false END,
  'US'
FROM brands b
WHERE b.wikidata_qid IS NOT NULL
  AND b.is_active = true
  AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.wikidata_qid = b.wikidata_qid)
  AND NOT EXISTS (SELECT 1 FROM companies c WHERE LOWER(c.name) = LOWER(b.name))
ON CONFLICT (wikidata_qid) DO NOTHING;