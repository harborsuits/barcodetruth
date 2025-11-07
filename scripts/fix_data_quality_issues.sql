-- =====================================================
-- DATA QUALITY CLEANUP SCRIPT
-- Fixes issues from corporate family and categorization bugs
-- =====================================================

-- Create rejected_entities table for validation logging
CREATE TABLE IF NOT EXISTS rejected_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name text NOT NULL,
  reason_rejected text NOT NULL,
  source text NOT NULL,
  attempted_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rejected_entities_attempted ON rejected_entities(attempted_at);

-- Create data_quality_log table for tracking cleanups
CREATE TABLE IF NOT EXISTS data_quality_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  details jsonb,
  timestamp timestamptz DEFAULT now()
);

-- 1. LOG BAD BRANDS BEFORE DELETION
INSERT INTO data_quality_log (action, entity_type, details, timestamp)
SELECT 
  'emergency_cleanup_identified_invalid_brands',
  'brands',
  jsonb_build_object(
    'total_count', COUNT(*),
    'examples', jsonb_agg(jsonb_build_object('id', id, 'name', name))
  ),
  now()
FROM brands 
WHERE name ~* '^(US patent|EP patent|patent #|patent no|trademark|copyright)'
   OR name ~* '(patent\s+\d{5,}|trademark\s+\d{4,}|©|®|™)'
   OR name ~* '^(article of|product of|method of|system for|apparatus for|device for)'
   OR description ~* '^(article of|product of|method of|system for|apparatus)';

-- 2. LOG BAD SUBSIDIARIES BEFORE DELETION
INSERT INTO data_quality_log (action, entity_type, details, timestamp)
SELECT 
  'emergency_cleanup_identified_invalid_ownership',
  'company_ownership',
  jsonb_build_object(
    'total_count', COUNT(*),
    'examples', jsonb_agg(jsonb_build_object(
      'id', id, 
      'parent_name', parent_name,
      'relationship', relationship
    ))
  ),
  now()
FROM company_ownership
WHERE parent_name ~* '(^article|^product|^item|^device|^apparatus|^method|^process|^system)'
  OR parent_name ~* '(trademark$|patent$)'
  OR parent_name ~* '(reinforced|braided|woven|manufactured|produced)';

-- 3. DELETE BAD SUBSIDIARY DATA
DELETE FROM company_ownership
WHERE parent_name ~* '(^article|^product|^item|^device|^apparatus|^method|^process|^system)'
  OR parent_name ~* '(trademark$|patent$)'
  OR parent_name ~* '(reinforced|braided|woven|manufactured|produced)';

-- 4. DELETE BAD BRANDS (with dependency handling)
-- First, try to delete brands without dependencies
WITH deletable_brands AS (
  SELECT b.id
  FROM brands b
  WHERE (
    b.name ~* '^(US patent|EP patent|patent #|patent no|trademark|copyright)'
    OR b.name ~* '(patent\s+\d{5,}|trademark\s+\d{4,}|©|®|™)'
    OR b.name ~* '^(article of|product of|method of|system for|apparatus for|device for)'
    OR b.description ~* '^(article of|product of|method of|system for|apparatus)'
  )
  AND NOT EXISTS (
    -- Check if brand has any user_scans
    SELECT 1 FROM user_scans WHERE brand_id = b.id
  )
)
DELETE FROM brands
WHERE id IN (SELECT id FROM deletable_brands);

-- 5. MARK REMAINING INVALID BRANDS AS INACTIVE
UPDATE brands
SET is_active = false,
    description = COALESCE(description, '') || ' [INVALID: Flagged as patent/trademark/generic description]'
WHERE (
  name ~* '^(US patent|EP patent|patent #|patent no|trademark|copyright)'
  OR name ~* '(patent\s+\d{5,}|trademark\s+\d{4,}|©|®|™)'
  OR name ~* '^(article of|product of|method of|system for|apparatus for|device for)'
  OR description ~* '^(article of|product of|method of|system for|apparatus)'
)
AND is_active = true;

-- 6. FIX MISCATEGORIZED POLITICS ARTICLES
-- Update Social -> Politics for articles with political keywords
UPDATE brand_events
SET 
  category = 'politics',
  category_code = 'POLICY.POLITICAL',
  updated_at = now()
WHERE 
  category = 'social'
  AND (
    title ~* '(trump|biden|harris|pence|president|vice president|election|campaign|rally|white house|executive order|administration|congress|senator|governor)'
    OR description ~* '(trump|biden|harris|pence|president|vice president|election|campaign|rally|white house|executive order|administration|congress|senator|governor)'
  );

-- 7. AUDIT REPORT: Show what was fixed
SELECT 
  'Bad subsidiaries removed' as fix_type,
  COUNT(*) as count
FROM company_ownership
WHERE parent_name ~* '(^article|^product|^item|^device|^apparatus|^method|^process|^system)'
  OR parent_name ~* '(trademark$|patent$)'
  OR parent_name ~* '(reinforced|braided|woven|manufactured|produced)'

UNION ALL

SELECT 
  'Invalid brands deleted' as fix_type,
  (SELECT COUNT(*) FROM data_quality_log 
   WHERE action = 'emergency_cleanup_identified_invalid_brands' 
   AND timestamp > now() - interval '1 hour')::bigint as count

UNION ALL

SELECT 
  'Invalid brands marked inactive' as fix_type,
  COUNT(*) as count
FROM brands
WHERE is_active = false
  AND description LIKE '%[INVALID:%'

UNION ALL

SELECT 
  'Politics articles recategorized' as fix_type,
  COUNT(*) as count
FROM brand_events
WHERE category = 'politics'
  AND category_code = 'POLICY.POLITICAL'
  AND updated_at > now() - interval '1 hour';

-- 8. VALIDATION: Check remaining issues
SELECT 
  'Remaining invalid brands (active)' as issue_type,
  COUNT(*) as count
FROM brands
WHERE is_active = true
  AND (
    name ~* '(patent|trademark|article of)'
    OR description ~* '(patent|trademark|article of)'
  )

UNION ALL

SELECT 
  'Brands with bad subsidiaries' as issue_type,
  COUNT(DISTINCT b.id) as count
FROM brands b
JOIN company_ownership co ON co.child_brand_id = b.id
WHERE co.parent_name ~* '(patent|trademark|article of)';

-- 9. TOP BRANDS VERIFICATION (ensure we didn't delete real brands)
SELECT 
  name,
  scan_count,
  is_active,
  created_at
FROM brands
WHERE scan_count > 0
ORDER BY scan_count DESC
LIMIT 20;
