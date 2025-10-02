-- Ownership System Monitoring Queries
-- Use these to track coverage, quality, and usage of the ownership system

-- ============================================
-- COVERAGE METRICS
-- ============================================

-- Overall ownership coverage
-- Shows what % of brands have at least one parent defined
SELECT
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM brand_ownerships bo WHERE bo.brand_id = b.id
  ))::float / NULLIF(COUNT(*), 0) * 100 AS pct_with_owner,
  COUNT(*) AS total_brands,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM brand_ownerships bo WHERE bo.brand_id = b.id
  )) AS brands_with_owner
FROM brands b;

-- Coverage by confidence level
SELECT
  CASE
    WHEN confidence >= 90 THEN 'High (90+)'
    WHEN confidence >= 70 THEN 'Medium (70-89)'
    WHEN confidence >= 50 THEN 'Low (50-69)'
    ELSE 'Very Low (<50)'
  END AS confidence_bucket,
  COUNT(*) AS edge_count,
  COUNT(DISTINCT brand_id) AS unique_brands
FROM brand_ownerships
GROUP BY confidence_bucket
ORDER BY confidence_bucket DESC;

-- Brands with no ownership data (prioritize these for enrichment)
SELECT
  b.id,
  b.name,
  b.wikidata_qid,
  COUNT(p.id) AS product_count
FROM brands b
LEFT JOIN products p ON p.brand_id = b.id
WHERE NOT EXISTS (
  SELECT 1 FROM brand_ownerships bo WHERE bo.brand_id = b.id
)
GROUP BY b.id, b.name, b.wikidata_qid
ORDER BY product_count DESC
LIMIT 50;

-- ============================================
-- QUALITY METRICS
-- ============================================

-- Source breakdown
SELECT
  source,
  COUNT(*) AS edge_count,
  COUNT(DISTINCT brand_id) AS unique_brands,
  AVG(confidence)::numeric(5,2) AS avg_confidence
FROM brand_ownerships
GROUP BY source
ORDER BY edge_count DESC;

-- Relationship type distribution
SELECT
  relationship_type,
  COUNT(*) AS edge_count,
  COUNT(DISTINCT brand_id) AS unique_brands
FROM brand_ownerships
GROUP BY relationship_type
ORDER BY edge_count DESC;

-- Potential loops (brands that appear as both child and parent)
SELECT
  b.name AS brand_name,
  COUNT(DISTINCT bo_as_child.parent_brand_id) AS parent_count,
  COUNT(DISTINCT bo_as_parent.brand_id) AS child_count
FROM brands b
LEFT JOIN brand_ownerships bo_as_child ON bo_as_child.brand_id = b.id
LEFT JOIN brand_ownerships bo_as_parent ON bo_as_parent.parent_brand_id = b.id
WHERE bo_as_child.parent_brand_id IS NOT NULL 
  AND bo_as_parent.brand_id IS NOT NULL
GROUP BY b.id, b.name;

-- Brands with multiple parents (unusual, might indicate data quality issues)
SELECT
  b.name AS brand_name,
  COUNT(DISTINCT bo.parent_brand_id) AS parent_count,
  ARRAY_AGG(DISTINCT p.name ORDER BY p.name) AS parent_names
FROM brands b
JOIN brand_ownerships bo ON bo.brand_id = b.id
JOIN brands p ON p.id = bo.parent_brand_id
GROUP BY b.id, b.name
HAVING COUNT(DISTINCT bo.parent_brand_id) > 1
ORDER BY parent_count DESC;

-- ============================================
-- USAGE METRICS
-- ============================================

-- Most-viewed parent companies (proxy: how many brands roll up to each parent)
SELECT
  parent.name AS parent_name,
  parent.wikidata_qid,
  COUNT(DISTINCT bo.brand_id) AS child_brand_count,
  COUNT(DISTINCT p.id) AS total_products
FROM brand_ownerships bo
JOIN brands parent ON parent.id = bo.parent_brand_id
LEFT JOIN products p ON p.brand_id = bo.brand_id
GROUP BY parent.id, parent.name, parent.wikidata_qid
ORDER BY child_brand_count DESC
LIMIT 25;

-- Brands with most products but no ownership data (high-impact targets)
SELECT
  b.name,
  b.wikidata_qid,
  COUNT(p.id) AS product_count
FROM brands b
JOIN products p ON p.brand_id = b.id
WHERE NOT EXISTS (
  SELECT 1 FROM brand_ownerships bo WHERE bo.brand_id = b.id
)
GROUP BY b.id, b.name, b.wikidata_qid
ORDER BY product_count DESC
LIMIT 20;

-- ============================================
-- MAINTENANCE QUERIES
-- ============================================

-- Recently added ownership edges (useful for auditing)
SELECT
  b.name AS brand_name,
  p.name AS parent_name,
  bo.relationship_type,
  bo.source,
  bo.confidence,
  bo.created_at
FROM brand_ownerships bo
JOIN brands b ON b.id = bo.brand_id
JOIN brands p ON p.id = bo.parent_brand_id
ORDER BY bo.created_at DESC
LIMIT 50;

-- Stale ownership data (no updates in 6+ months, might need refresh)
SELECT
  b.name AS brand_name,
  p.name AS parent_name,
  bo.relationship_type,
  bo.source,
  bo.updated_at,
  AGE(NOW(), bo.updated_at) AS staleness
FROM brand_ownerships bo
JOIN brands b ON b.id = bo.brand_id
JOIN brands p ON p.id = bo.parent_brand_id
WHERE bo.updated_at < NOW() - INTERVAL '6 months'
ORDER BY bo.updated_at ASC
LIMIT 50;

-- Brands with Wikidata QID but no ownership (ready for enrichment)
SELECT
  b.id,
  b.name,
  b.wikidata_qid,
  COUNT(p.id) AS product_count
FROM brands b
LEFT JOIN products p ON p.brand_id = b.id
WHERE b.wikidata_qid IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM brand_ownerships bo WHERE bo.brand_id = b.id
  )
GROUP BY b.id, b.name, b.wikidata_qid
ORDER BY product_count DESC
LIMIT 30;
