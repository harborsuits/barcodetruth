-- =====================================================
-- DATA QUALITY CLEANUP SCRIPT
-- Fixes issues from corporate family and categorization bugs
-- =====================================================

-- 1. IDENTIFY AND LOG BAD SUBSIDIARIES
-- Find brands with trademark/patent descriptions in their corporate family
SELECT 
  b.name as brand_name,
  co.parent_name,
  co.confidence,
  co.relationship
FROM brands b
JOIN company_ownership co ON co.child_brand_id = b.id
WHERE 
  -- Trademark/patent patterns
  co.parent_name ~* '(^article|^product|^item|^device|^apparatus|^method|^process|^system)'
  OR co.parent_name ~* '(trademark$|patent$)'
  OR co.parent_name ~* '(reinforced|braided|woven|manufactured|produced)'
ORDER BY b.name;

-- 2. DELETE BAD SUBSIDIARY DATA
-- Remove trademark/patent entries from company_ownership
DELETE FROM company_ownership
WHERE 
  parent_name ~* '(^article|^product|^item|^device|^apparatus|^method|^process|^system)'
  OR parent_name ~* '(trademark$|patent$)'
  OR parent_name ~* '(reinforced|braided|woven|manufactured|produced)';

-- 3. FIX MISCATEGORIZED POLITICS ARTICLES
-- Find articles with political keywords but categorized as Social
SELECT 
  be.event_id,
  b.name as brand_name,
  be.title,
  be.category,
  be.category_code
FROM brand_events be
JOIN brands b ON b.id = be.brand_id
WHERE 
  be.category = 'social'
  AND (
    be.title ~* '(trump|biden|president|election|campaign|rally|political|white house|executive order|administration)'
    OR be.description ~* '(trump|biden|president|election|campaign|rally|political|white house|executive order|administration)'
  )
ORDER BY be.event_date DESC
LIMIT 100;

-- 4. RECATEGORIZE POLITICAL ARTICLES
-- Update Social -> Politics for articles with political keywords
UPDATE brand_events
SET 
  category = 'politics',
  category_code = 'POLICY.POLITICAL',
  updated_at = now()
WHERE 
  category = 'social'
  AND (
    title ~* '(trump|biden|president|election|campaign|rally|political|white house|executive order|administration)'
    OR description ~* '(trump|biden|president|election|campaign|rally|political|white house|executive order|administration)'
  );

-- 5. AUDIT REPORT: Show what was fixed
SELECT 
  'Bad subsidiaries removed' as fix_type,
  COUNT(*) as count
FROM company_ownership
WHERE 
  parent_name ~* '(^article|^product|^item|^device|^apparatus|^method|^process|^system)'
  OR parent_name ~* '(trademark$|patent$)'
  OR parent_name ~* '(reinforced|braided|woven|manufactured|produced)'

UNION ALL

SELECT 
  'Politics articles recategorized' as fix_type,
  COUNT(*) as count
FROM brand_events
WHERE 
  category = 'social'
  AND (
    title ~* '(trump|biden|president|election|campaign|rally|political|white house|executive order|administration)'
    OR description ~* '(trump|biden|president|election|campaign|rally|political|white house|executive order|administration)'
  );

-- 6. VALIDATE: Check for remaining issues
-- Brands still missing corporate family data
SELECT 
  b.name,
  b.wikidata_qid,
  b.created_at
FROM brands b
WHERE 
  b.wikidata_qid IS NOT NULL
  AND b.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM company_ownership co 
    WHERE co.child_brand_id = b.id
  )
ORDER BY b.created_at DESC
LIMIT 50;
