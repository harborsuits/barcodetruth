-- Fix orphaned Target company
INSERT INTO company_ownership (child_brand_id, parent_company_id, parent_name, relationship, source, confidence)
SELECT 
  b.id,
  c.id,
  c.name,
  'parent_organization',
  'system_heal',
  0.95
FROM brands b, companies c
WHERE b.name = 'Target' 
  AND c.wikidata_qid = 'Q1046951'
  AND NOT EXISTS (
    SELECT 1 FROM company_ownership 
    WHERE child_brand_id = b.id
  );

-- Fix orphaned Publix company  
INSERT INTO company_ownership (child_brand_id, parent_company_id, parent_name, relationship, source, confidence)
SELECT 
  b.id,
  c.id,
  c.name,
  'parent_organization',
  'system_heal',
  0.95
FROM brands b, companies c
WHERE b.name = 'Publix' 
  AND c.wikidata_qid = 'Q672170'
  AND NOT EXISTS (
    SELECT 1 FROM company_ownership 
    WHERE child_brand_id = b.id
  );