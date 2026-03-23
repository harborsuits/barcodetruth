CREATE OR REPLACE VIEW public.v_ownership_conflicts AS
-- Investor treated as operating parent
SELECT 
  'investor_as_operating_parent'::text AS conflict_type,
  co.child_brand_id,
  b.name AS brand_name,
  'Investor "' || co.parent_name || '" has role ' || COALESCE(co.relationship_role::text, co.relationship) AS detail,
  co.confidence
FROM company_ownership co
JOIN brands b ON b.id = co.child_brand_id
JOIN asset_managers am ON am.name ILIKE '%' || co.parent_name || '%'
WHERE co.relationship IN ('parent', 'subsidiary', 'parent_organization', 'owned_by')
  AND (co.relationship_role IS NULL OR co.relationship_role NOT IN ('major_shareholder', 'private_equity_sponsor', 'investor'))

UNION ALL

-- Multiple current parents
SELECT
  'multiple_current_parents'::text,
  co.child_brand_id,
  b.name,
  'Has ' || COUNT(*)::text || ' current parent records',
  MAX(co.confidence)
FROM company_ownership co
JOIN brands b ON b.id = co.child_brand_id
WHERE co.relationship IN ('parent', 'subsidiary', 'parent_organization', 'owned_by')
  AND (co.is_current IS NULL OR co.is_current = true)
GROUP BY co.child_brand_id, b.name
HAVING COUNT(*) > 1

UNION ALL

-- Low confidence parent
SELECT
  'low_confidence_parent'::text,
  co.child_brand_id,
  b.name,
  'Parent "' || co.parent_name || '" confidence=' || ROUND(co.confidence::numeric, 2)::text,
  co.confidence
FROM company_ownership co
JOIN brands b ON b.id = co.child_brand_id
WHERE co.relationship IN ('parent', 'subsidiary', 'parent_organization', 'owned_by')
  AND co.confidence < 0.5
  AND (co.is_current IS NULL OR co.is_current = true);