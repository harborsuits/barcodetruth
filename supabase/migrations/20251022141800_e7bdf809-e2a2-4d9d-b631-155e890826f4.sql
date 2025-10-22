-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_brand_ownership(uuid) TO anon, authenticated;

-- Add unique constraint on companies.name
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_name_key') THEN
    ALTER TABLE companies ADD CONSTRAINT companies_name_key UNIQUE (name);
  END IF;
END $$;

-- Seed Kroger
DO $$
DECLARE
  kroger_brand_id uuid;
  kroger_company_id uuid;
BEGIN
  SELECT id INTO kroger_brand_id FROM brands WHERE name ILIKE 'Kroger' LIMIT 1;
  
  IF kroger_brand_id IS NOT NULL THEN
    INSERT INTO companies (id, name, is_public, ticker, exchange, country)
    VALUES (gen_random_uuid(), 'The Kroger Co.', true, 'KR', 'NYSE', 'United States')
    ON CONFLICT (name) DO UPDATE SET is_public = true, ticker = COALESCE(companies.ticker, 'KR')
    RETURNING id INTO kroger_company_id;
    
    INSERT INTO company_ownership (id, parent_company_id, child_brand_id, parent_name, relationship, source, confidence)
    VALUES (gen_random_uuid(), kroger_company_id, kroger_brand_id, 'The Kroger Co.', 'parent', 'wikidata', 0.95)
    ON CONFLICT DO NOTHING;
    
    INSERT INTO company_shareholders (id, company_id, holder_name, holder_type, percent_owned, as_of, source, source_name, source_url)
    VALUES
      (gen_random_uuid(), kroger_company_id, 'Vanguard', 'institutional', 10.05, '2025-09-30', 'sec_13f', 'SEC 13F', 'https://www.sec.gov/cgi-bin/browse-edgar'),
      (gen_random_uuid(), kroger_company_id, 'BlackRock', 'institutional', 7.41, '2025-09-30', 'sec_13f', 'SEC 13F', 'https://www.sec.gov/cgi-bin/browse-edgar'),
      (gen_random_uuid(), kroger_company_id, 'State Street', 'institutional', 4.00, '2025-09-30', 'sec_13f', 'SEC 13F', 'https://www.sec.gov/cgi-bin/browse-edgar')
    ON CONFLICT DO NOTHING;
    
    UPDATE company_shareholders cs SET directory_id = sd.id
    FROM shareholders_directory sd
    WHERE cs.company_id = kroger_company_id AND cs.directory_id IS NULL AND lower(cs.holder_name) = lower(sd.display_name);
    
    DELETE FROM company_groups_cache WHERE company_id = kroger_company_id;
  END IF;
END $$;

-- Backfill orphan brands (batch of 100)
WITH orphan_batch AS (
  SELECT b.id AS brand_id, b.name, b.wikidata_qid
  FROM brands b
  LEFT JOIN company_ownership co ON co.child_brand_id = b.id
  WHERE co.child_brand_id IS NULL AND b.is_active = true AND b.is_test = false
  LIMIT 100
)
INSERT INTO companies (id, name, is_public, wikidata_qid)
SELECT gen_random_uuid(), name, false, wikidata_qid FROM orphan_batch
ON CONFLICT (name) DO NOTHING;

WITH orphan_batch AS (
  SELECT b.id AS brand_id, b.name
  FROM brands b
  LEFT JOIN company_ownership co ON co.child_brand_id = b.id
  WHERE co.child_brand_id IS NULL AND b.is_active = true AND b.is_test = false
  LIMIT 100
)
INSERT INTO company_ownership (id, parent_company_id, child_brand_id, parent_name, relationship, source, confidence)
SELECT gen_random_uuid(), c.id, ob.brand_id, c.name, 'parent', 'bootstrap', 0.85
FROM orphan_batch ob
JOIN companies c ON c.name = ob.name
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_company_ownership_child_brand ON company_ownership(child_brand_id);
CREATE INDEX IF NOT EXISTS idx_company_ownership_parent ON company_ownership(parent_company_id);