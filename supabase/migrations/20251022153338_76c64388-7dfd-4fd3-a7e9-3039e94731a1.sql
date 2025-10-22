-- Fix: Create the missing ownership links with parent_name included

-- 1) Link Starbucks brand → Starbucks Corporation
INSERT INTO company_ownership (
  id, 
  parent_company_id, 
  child_brand_id,
  parent_name,
  relationship, 
  confidence, 
  source
)
SELECT 
  gen_random_uuid(),
  c.id,
  b.id,
  c.name,
  'parent',
  0.95,
  'wikidata'
FROM brands b
CROSS JOIN companies c
WHERE b.name = 'Starbucks' 
  AND c.name = 'Starbucks Corporation'
ON CONFLICT DO NOTHING;

-- 2) Link Kroger brand → The Kroger Co.
INSERT INTO company_ownership (
  id, 
  parent_company_id, 
  child_brand_id,
  parent_name,
  relationship, 
  confidence, 
  source
)
SELECT 
  gen_random_uuid(),
  c.id,
  b.id,
  c.name,
  'parent',
  0.95,
  'wikidata'
FROM brands b
CROSS JOIN companies c
WHERE b.name = 'Kroger' 
  AND c.name = 'The Kroger Co.'
ON CONFLICT DO NOTHING;

-- 3) Link Publix brand → Publix Super Markets, Inc.
INSERT INTO company_ownership (
  id, 
  parent_company_id, 
  child_brand_id,
  parent_name,
  relationship, 
  confidence, 
  source
)
SELECT 
  gen_random_uuid(),
  c.id,
  b.id,
  c.name,
  'parent',
  0.95,
  'wikidata'
FROM brands b
CROSS JOIN companies c
WHERE b.name = 'Publix' 
  AND c.name = 'Publix Super Markets, Inc.'
ON CONFLICT DO NOTHING;