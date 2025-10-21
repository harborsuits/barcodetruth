-- Add child_company_id column to support company → company ownership links
ALTER TABLE company_ownership 
ADD COLUMN IF NOT EXISTS child_company_id uuid REFERENCES companies(id) ON DELETE CASCADE;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_company_ownership_child_company 
ON company_ownership(child_company_id);

-- Update the constraint to allow either child_brand_id OR child_company_id (but not both)
-- Drop the NOT NULL constraint on child_brand_id first
ALTER TABLE company_ownership 
ALTER COLUMN child_brand_id DROP NOT NULL;

-- Add a check constraint to ensure either child_brand_id OR child_company_id exists (but not both)
ALTER TABLE company_ownership
DROP CONSTRAINT IF EXISTS check_child_type;

ALTER TABLE company_ownership
ADD CONSTRAINT check_child_type CHECK (
  (child_brand_id IS NOT NULL AND child_company_id IS NULL) OR
  (child_brand_id IS NULL AND child_company_id IS NOT NULL)
);

-- Now create the recursive view to query complete ownership trails
CREATE OR REPLACE VIEW v_ownership_trail AS
WITH RECURSIVE ownership_chain AS (
  -- Start with brands
  SELECT 
    b.id as entity_id,
    'brand'::text as entity_type,
    b.name as entity_name,
    b.logo_url,
    co.parent_company_id as parent_id,
    co.relationship,
    co.source,
    co.confidence,
    0 as level,
    ARRAY[b.id] as path_ids
  FROM brands b
  LEFT JOIN company_ownership co ON co.child_brand_id = b.id
  WHERE co.child_brand_id IS NOT NULL
  
  UNION ALL
  
  -- Recursively follow company → company links
  SELECT
    c.id as entity_id,
    'company'::text as entity_type,
    c.name as entity_name,
    c.logo_url,
    co.parent_company_id as parent_id,
    co.relationship,
    co.source,
    co.confidence,
    oc.level + 1 as level,
    oc.path_ids || c.id as path_ids
  FROM ownership_chain oc
  JOIN companies c ON c.id = oc.parent_id
  LEFT JOIN company_ownership co ON co.child_company_id = c.id
  WHERE oc.level < 10  -- Prevent infinite loops
    AND NOT (c.id = ANY(oc.path_ids))  -- Detect cycles
)
SELECT 
  entity_id,
  entity_type,
  entity_name,
  logo_url,
  parent_id,
  relationship,
  source,
  confidence,
  level,
  path_ids
FROM ownership_chain
ORDER BY level;