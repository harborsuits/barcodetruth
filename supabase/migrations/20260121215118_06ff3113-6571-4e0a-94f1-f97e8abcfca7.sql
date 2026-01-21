
-- Fix the brand_events_with_inheritance view to JOIN via parent_name text instead of broken parent_company_id UUID
-- The parent_company_id column contains orphaned UUIDs that don't exist in brands table
-- But parent_name text DOES match brands.name

CREATE OR REPLACE VIEW brand_events_with_inheritance AS
-- Direct events (brand's own events)
SELECT 
  be.event_id,
  be.brand_id,
  be.title,
  be.description,
  be.event_date,
  be.occurred_at,
  be.source_url,
  be.category,
  be.category_code,
  be.orientation,
  be.severity,
  be.category_impacts,
  be.impact_labor,
  be.impact_environment,
  be.impact_politics,
  be.impact_social,
  be.verification,
  be.credibility,
  be.created_at,
  be.updated_at,
  be.relevance_score_raw,
  be.relevance_score_norm,
  be.verified,
  be.resolved,
  be.is_test,
  false AS inherited_from_parent,
  NULL::text AS parent_brand_name,
  NULL::uuid AS parent_brand_id,
  1.0 AS scope_multiplier
FROM brand_events be

UNION ALL

-- Inherited events (parent company events flowing down to subsidiaries)
SELECT 
  parent_be.event_id,
  child_brand.id AS brand_id,  -- Subsidiary brand receives the event
  parent_be.title,
  parent_be.description,
  parent_be.event_date,
  parent_be.occurred_at,
  parent_be.source_url,
  parent_be.category,
  parent_be.category_code,
  parent_be.orientation,
  parent_be.severity,
  parent_be.category_impacts,
  parent_be.impact_labor,
  parent_be.impact_environment,
  parent_be.impact_politics,
  parent_be.impact_social,
  parent_be.verification,
  parent_be.credibility,
  parent_be.created_at,
  parent_be.updated_at,
  parent_be.relevance_score_raw,
  parent_be.relevance_score_norm,
  parent_be.verified,
  parent_be.resolved,
  parent_be.is_test,
  true AS inherited_from_parent,
  parent_brand.name AS parent_brand_name,
  parent_brand.id AS parent_brand_id,
  0.7 AS scope_multiplier  -- Parent events contribute at 70% weight
FROM brand_events parent_be
-- Find the parent brand that has these events
JOIN brands parent_brand ON parent_be.brand_id = parent_brand.id
-- Find ownership links where this brand is the parent (matched by name)
JOIN company_ownership co ON LOWER(co.parent_name) = LOWER(parent_brand.name)
-- Find the child/subsidiary brand
JOIN brands child_brand ON co.child_brand_id = child_brand.id
WHERE parent_be.is_test = false;
