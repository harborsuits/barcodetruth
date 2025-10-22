-- Ensure RPC has proper permissions
GRANT EXECUTE ON FUNCTION get_brand_ownership(uuid) TO anon, authenticated;

-- Seed Starbucks with complete ownership structure
DO $$
DECLARE
  starbucks_brand_id uuid;
  starbucks_company_id uuid;
BEGIN
  -- Get Starbucks brand
  SELECT id INTO starbucks_brand_id FROM brands WHERE name ILIKE 'Starbucks' LIMIT 1;
  
  IF starbucks_brand_id IS NOT NULL THEN
    -- Create/update Starbucks Corporation
    INSERT INTO companies (id, name, is_public, ticker, exchange, country)
    VALUES (gen_random_uuid(), 'Starbucks Corporation', true, 'SBUX', 'NASDAQ', 'United States')
    ON CONFLICT (name) DO UPDATE
    SET is_public = true, ticker = 'SBUX', exchange = 'NASDAQ'
    RETURNING id INTO starbucks_company_id;
    
    -- Link brand to company (control chain)
    INSERT INTO company_ownership (id, parent_company_id, child_brand_id, parent_name, relationship, source, confidence)
    VALUES (gen_random_uuid(), starbucks_company_id, starbucks_brand_id, 'Starbucks Corporation', 'parent', 'wikidata', 0.95)
    ON CONFLICT DO NOTHING;
    
    -- Add institutional shareholders (for Shareholders tab donut)
    INSERT INTO company_shareholders (id, company_id, holder_name, holder_type, percent_owned, as_of, source, source_name, source_url, holder_url, wikipedia_url)
    VALUES
      (gen_random_uuid(), starbucks_company_id, 'Vanguard', 'institutional', 9.74, '2025-09-30', 'sec_13f', 'SEC 13F', 'https://www.sec.gov/cgi-bin/browse-edgar', 'https://investor.vanguard.com', 'https://en.wikipedia.org/wiki/The_Vanguard_Group'),
      (gen_random_uuid(), starbucks_company_id, 'BlackRock', 'institutional', 6.96, '2025-09-30', 'sec_13f', 'SEC 13F', 'https://www.sec.gov/cgi-bin/browse-edgar', 'https://www.blackrock.com', 'https://en.wikipedia.org/wiki/BlackRock'),
      (gen_random_uuid(), starbucks_company_id, 'State Street', 'institutional', 4.06, '2025-09-30', 'sec_13f', 'SEC 13F', 'https://www.sec.gov/cgi-bin/browse-edgar', 'https://www.statestreet.com', 'https://en.wikipedia.org/wiki/State_Street_Corporation'),
      (gen_random_uuid(), starbucks_company_id, 'Capital Group', 'institutional', 4.04, '2025-09-30', 'sec_13f', 'SEC 13F', 'https://www.sec.gov/cgi-bin/browse-edgar', 'https://www.capitalgroup.com', 'https://en.wikipedia.org/wiki/Capital_Group_Companies'),
      (gen_random_uuid(), starbucks_company_id, 'Geode Capital', 'institutional', 1.45, '2025-09-30', 'sec_13f', 'SEC 13F', 'https://www.sec.gov/cgi-bin/browse-edgar', NULL, NULL),
      (gen_random_uuid(), starbucks_company_id, 'Insiders', 'insider', 1.70, '2025-09-30', 'sec_13f', 'SEC 13F', NULL, NULL, NULL)
    ON CONFLICT DO NOTHING;
    
    -- Link to shareholders directory where available
    UPDATE company_shareholders cs
    SET directory_id = sd.id
    FROM shareholders_directory sd
    WHERE cs.company_id = starbucks_company_id
      AND cs.directory_id IS NULL
      AND lower(cs.holder_name) = lower(sd.display_name);
    
    -- Bust cache
    DELETE FROM company_groups_cache WHERE company_id = starbucks_company_id;
  END IF;
END $$;

-- Backfill orphan brands to ensure all brands have at least a two-node chain
WITH orphan_brands AS (
  SELECT b.id, b.name, b.wikidata_qid
  FROM brands b
  LEFT JOIN company_ownership co ON co.child_brand_id = b.id
  WHERE co.child_brand_id IS NULL
    AND b.is_active = true
    AND b.is_test = false
  LIMIT 100
)
INSERT INTO companies (id, name, is_public, wikidata_qid)
SELECT gen_random_uuid(), name, false, wikidata_qid
FROM orphan_brands
ON CONFLICT (name) DO NOTHING;

-- Link orphan brands to their companies
WITH orphan_brands AS (
  SELECT b.id AS brand_id, b.name
  FROM brands b
  LEFT JOIN company_ownership co ON co.child_brand_id = b.id
  WHERE co.child_brand_id IS NULL
    AND b.is_active = true
    AND b.is_test = false
  LIMIT 100
)
INSERT INTO company_ownership (id, parent_company_id, child_brand_id, parent_name, relationship, source, confidence)
SELECT gen_random_uuid(), c.id, ob.brand_id, c.name, 'parent', 'bootstrap', 0.9
FROM orphan_brands ob
JOIN companies c ON c.name = ob.name
ON CONFLICT DO NOTHING;