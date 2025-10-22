-- Test ownership enrichment for a few major brands
-- Run this to verify parent companies and key people are being extracted correctly

-- 1. Check which brands have Wikidata IDs but no ownership data yet
SELECT 
  b.id,
  b.name,
  b.wikidata_qid,
  b.parent_company as legacy_parent,
  CASE 
    WHEN co.id IS NULL THEN '❌ No ownership data'
    ELSE '✅ Has ownership data'
  END as status
FROM brands b
LEFT JOIN company_ownership co ON co.child_brand_id = b.id
WHERE b.wikidata_qid IS NOT NULL
  AND b.is_active = true
ORDER BY 
  CASE WHEN co.id IS NULL THEN 0 ELSE 1 END,
  b.name
LIMIT 20;

-- 2. Check parent companies with details
SELECT 
  b.name as brand_name,
  b.wikidata_qid as brand_qid,
  co.parent_name,
  co.relationship,
  co.confidence,
  co.source,
  c.name as parent_company_name,
  c.wikidata_qid as parent_qid,
  c.country,
  c.is_public,
  c.ticker,
  LENGTH(c.description) as description_length,
  c.logo_url IS NOT NULL as has_logo
FROM brands b
JOIN company_ownership co ON co.child_brand_id = b.id
LEFT JOIN companies c ON c.id = co.parent_company_id
WHERE b.is_active = true
ORDER BY b.name
LIMIT 20;

-- 3. Check key people data
SELECT 
  b.name as brand_name,
  co.parent_name,
  cp.role,
  cp.person_name,
  cp.person_qid,
  cp.image_url IS NOT NULL as has_image,
  cp.source
FROM brands b
JOIN company_ownership co ON co.child_brand_id = b.id
JOIN company_people cp ON cp.company_id = co.parent_company_id
WHERE b.is_active = true
ORDER BY 
  b.name,
  CASE cp.role 
    WHEN 'chief_executive_officer' THEN 1
    WHEN 'chairperson' THEN 2
    WHEN 'founder' THEN 3
    ELSE 4
  END;

-- 4. Check SEC ticker mappings from parent companies
SELECT 
  b.name as brand_name,
  c.name as parent_name,
  c.ticker,
  c.is_public,
  bdm.external_id as mapped_ticker,
  bdm.source
FROM brands b
JOIN company_ownership co ON co.child_brand_id = b.id
JOIN companies c ON c.id = co.parent_company_id
LEFT JOIN brand_data_mappings bdm ON bdm.brand_id = b.id 
  AND bdm.source = 'sec' 
  AND bdm.label = 'ticker'
WHERE c.is_public = true
  AND b.is_active = true
ORDER BY b.name;

-- 5. Find good test candidates for enrichment
-- (brands with Wikidata IDs but missing ownership or people data)
SELECT 
  b.id,
  b.name,
  b.wikidata_qid,
  COUNT(DISTINCT co.id) as ownership_count,
  COUNT(DISTINCT cp.id) as people_count,
  CASE 
    WHEN COUNT(DISTINCT co.id) = 0 THEN '🔴 Ready for enrichment'
    WHEN COUNT(DISTINCT cp.id) = 0 THEN '🟡 Has ownership, needs people'
    ELSE '🟢 Fully enriched'
  END as enrichment_status
FROM brands b
LEFT JOIN company_ownership co ON co.child_brand_id = b.id
LEFT JOIN company_people cp ON cp.company_id = co.parent_company_id
WHERE b.wikidata_qid IS NOT NULL
  AND b.is_active = true
GROUP BY b.id, b.name, b.wikidata_qid
ORDER BY ownership_count ASC, people_count ASC, b.name
LIMIT 30;

-- 6. Validate role names are correct (should all be snake_case)
SELECT 
  cp.role,
  COUNT(*) as count,
  CASE 
    WHEN cp.role IN ('chief_executive_officer', 'chairperson', 'founder') THEN '✅ Valid'
    ELSE '⚠️ Invalid - needs fixing'
  END as validation
FROM company_people cp
GROUP BY cp.role
ORDER BY count DESC;
