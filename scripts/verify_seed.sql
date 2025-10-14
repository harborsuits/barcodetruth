-- TICKET A Verification Script
-- Run this to verify product seeding completed successfully

-- Test 1: Total products and distinct brands
SELECT 
  COUNT(*) as total_products,
  COUNT(DISTINCT brand_id) as distinct_brands
FROM products;

-- Test 2: Sample 20 products ordered by most recent
SELECT 
  p.barcode as upc,
  p.name,
  b.name as brand_name,
  b.parent_company,
  p.category,
  p.created_at
FROM products p
LEFT JOIN brands b ON b.id = p.brand_id
ORDER BY p.created_at DESC
LIMIT 20;

-- Test 3: Products per brand breakdown
SELECT 
  b.name as brand_name,
  b.parent_company,
  COUNT(p.id) as product_count
FROM brands b
LEFT JOIN products p ON p.brand_id = b.id
GROUP BY b.id, b.name, b.parent_company
HAVING COUNT(p.id) > 0
ORDER BY product_count DESC;

-- Test 4: Verify text search index exists
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'products' 
  AND indexname = 'idx_products_name_trgm';

-- Test 5: Sample products from each major parent company
SELECT 
  b.parent_company,
  COUNT(DISTINCT b.id) as brands_count,
  COUNT(p.id) as products_count,
  string_agg(DISTINCT b.name, ', ') as brand_names
FROM brands b
LEFT JOIN products p ON p.brand_id = b.id
WHERE b.parent_company IN (
  'The Coca-Cola Company',
  'PepsiCo',
  'Nestlé S.A.',
  'Unilever',
  'Procter & Gamble',
  'Johnson & Johnson',
  'Kraft Heinz',
  'General Mills Inc',
  'Mars Inc',
  'Mondelez International',
  'Colgate-Palmolive',
  'Kellogg Company',
  'Danone S.A.'
)
GROUP BY b.parent_company
ORDER BY products_count DESC;

-- Test 6 (A2): UPC type and checksum validation breakdown
SELECT 
  upc_type,
  valid_checksum,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM products), 1) as percentage
FROM products
GROUP BY upc_type, valid_checksum
ORDER BY upc_type, valid_checksum;
