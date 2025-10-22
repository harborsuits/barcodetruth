-- ====================
-- WALMART STANDARD: GAP DETECTION QUERIES
-- Run weekly to find brands missing key data
-- ====================

-- 1) Missing descriptions (< 40 chars)
SELECT 
  id, 
  name,
  COALESCE(LENGTH(description), 0) AS desc_length
FROM brands 
WHERE is_active = true
  AND COALESCE(LENGTH(description), 0) < 40
ORDER BY name;

-- 2) No parent company (but likely should have one for public companies)
SELECT 
  b.id, 
  b.name,
  b.is_test
FROM brands b
LEFT JOIN company_ownership co 
  ON co.child_brand_id = b.id 
  AND co.relationship_type IN ('parent', 'subsidiary', 'parent_organization')
WHERE b.is_active = true
  AND co.id IS NULL
ORDER BY b.name;

-- 3) Key people missing
SELECT 
  b.id, 
  b.name
FROM brands b
LEFT JOIN company_ownership co ON co.child_brand_id = b.id
LEFT JOIN company_people kp ON kp.company_id = co.parent_company_id
WHERE b.is_active = true
GROUP BY b.id, b.name
HAVING COUNT(kp.*) = 0
ORDER BY b.name;

-- 4) Public companies without shareholders
SELECT 
  b.id, 
  b.name
FROM brands b
JOIN company_ownership co ON co.child_brand_id = b.id
JOIN companies c ON c.id = co.parent_company_id
LEFT JOIN company_shareholders sh 
  ON sh.company_id = co.parent_company_id 
  AND sh.holder_type = 'institutional'
WHERE b.is_active = true
  AND c.is_public = true
GROUP BY b.id, b.name
HAVING COALESCE(SUM(1), 0) = 0
ORDER BY b.name;

-- 5) Missing any of the 4 category scores
SELECT 
  b.id,
  b.name,
  s.score_labor,
  s.score_environment,
  s.score_politics,
  s.score_social
FROM brands b
LEFT JOIN brand_scores s ON s.brand_id = b.id
WHERE b.is_active = true
  AND (
    s.score_labor IS NULL 
    OR s.score_environment IS NULL 
    OR s.score_politics IS NULL 
    OR s.score_social IS NULL
  )
ORDER BY b.name;

-- 6) Overall coverage dashboard
SELECT
  COUNT(*) FILTER (WHERE has_description) * 100.0 / COUNT(*) AS pct_description,
  COUNT(*) FILTER (WHERE has_parent_company) * 100.0 / COUNT(*) AS pct_parent,
  COUNT(*) FILTER (WHERE has_key_people) * 100.0 / COUNT(*) AS pct_key_people,
  COUNT(*) FILTER (WHERE has_shareholders) * 100.0 / COUNT(*) AS pct_shareholders,
  COUNT(*) FILTER (WHERE has_all_scores) * 100.0 / COUNT(*) AS pct_scores,
  COUNT(*) AS total_brands
FROM brand_profile_coverage;

-- 7) Brands with complete profiles (Walmart standard)
SELECT 
  brand_id,
  name
FROM brand_profile_coverage
WHERE has_description 
  AND has_parent_company 
  AND has_key_people 
  AND has_all_scores
ORDER BY name;

-- 8) Brands furthest from standard (prioritize these)
SELECT 
  brand_id,
  name,
  has_description,
  has_parent_company,
  has_key_people,
  has_shareholders,
  has_all_scores,
  (
    CASE WHEN has_description THEN 1 ELSE 0 END +
    CASE WHEN has_parent_company THEN 1 ELSE 0 END +
    CASE WHEN has_key_people THEN 1 ELSE 0 END +
    CASE WHEN has_shareholders THEN 1 ELSE 0 END +
    CASE WHEN has_all_scores THEN 1 ELSE 0 END
  ) AS completeness_score
FROM brand_profile_coverage
ORDER BY completeness_score ASC, name
LIMIT 20;
