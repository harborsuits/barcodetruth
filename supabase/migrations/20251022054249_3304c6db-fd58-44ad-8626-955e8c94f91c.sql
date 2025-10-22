-- Fix 1: Update get_brand_company_info to only return true parent relationships
-- Exclude 'shareholder' and 'owned_by' relationships from ownership display
CREATE OR REPLACE FUNCTION get_brand_company_info(p_brand_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'ownership', (
      SELECT jsonb_build_object(
        'parent_name', co.parent_name,
        'relationship', co.relationship,
        'confidence', co.confidence,
        'source', co.source,
        'company', (
          SELECT jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'ticker', c.ticker,
            'exchange', c.exchange,
            'is_public', c.is_public,
            'country', c.country,
            'description', c.description,
            'logo_url', c.logo_url,
            'wikidata_qid', c.wikidata_qid
          )
          FROM companies c
          WHERE c.id = co.parent_company_id
        )
      )
      FROM company_ownership co
      WHERE co.child_brand_id = p_brand_id
        -- CRITICAL: Only show true parent relationships, NOT shareholders
        AND co.relationship IN ('parent', 'subsidiary', 'parent_organization')
        AND co.confidence >= 0.7
      ORDER BY co.confidence DESC
      LIMIT 1
    ),
    'people', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'role', cp.role,
          'name', cp.person_name,
          'image_url', cp.image_url,
          'source', cp.source,
          'person_qid', cp.person_qid
        ) ORDER BY 
          CASE cp.role
            WHEN 'chief_executive_officer' THEN 1
            WHEN 'chairperson' THEN 2
            WHEN 'founder' THEN 3
            ELSE 4
          END
      )
      FROM company_people cp
      WHERE cp.company_id = (
        SELECT parent_company_id 
        FROM company_ownership
        WHERE child_brand_id = p_brand_id
          AND relationship IN ('parent', 'subsidiary', 'parent_organization')
          AND confidence >= 0.7
        ORDER BY confidence DESC
        LIMIT 1
      )
    ),
    'valuation', (
      SELECT jsonb_build_object(
        'metric', cv.metric,
        'value', cv.value_numeric,
        'currency', cv.currency,
        'as_of_date', cv.as_of_date,
        'source', cv.source
      )
      FROM company_valuation cv
      WHERE cv.company_id = (
        SELECT parent_company_id 
        FROM company_ownership
        WHERE child_brand_id = p_brand_id
          AND relationship IN ('parent', 'subsidiary', 'parent_organization')
          AND confidence >= 0.7
        ORDER BY confidence DESC
        LIMIT 1
      )
      ORDER BY cv.as_of_date DESC
      LIMIT 1
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Fix 2: Clean up existing incorrect parent relationships
-- Demote known asset managers from 'parent'/'owned_by' to 'shareholder'
UPDATE company_ownership co
SET 
  relationship = 'shareholder',
  confidence = LEAST(COALESCE(confidence, 0.6), 0.7)
FROM companies p
WHERE co.parent_company_id = p.id
  AND co.relationship IN ('owned_by', 'parent', 'parent_organization')
  AND (
    p.name ILIKE ANY(ARRAY[
      '%BlackRock%',
      '%Vanguard%',
      '%State Street%',
      '%Fidelity%',
      '%Capital Group%',
      '%T. Rowe Price%',
      '%Wellington Management%',
      '%Geode Capital%',
      '%Northern Trust%',
      '%Invesco%'
    ])
    OR p.description ILIKE '%asset management%'
    OR p.description ILIKE '%investment management%'
    OR p.description ILIKE '%institutional investor%'
  );

-- Fix 3: Add a new column to track relationship type more explicitly
-- This helps distinguish control vs. ownership vs. shareholding
ALTER TABLE company_ownership ADD COLUMN IF NOT EXISTS relationship_type text;

-- Update existing relationships to have proper types
UPDATE company_ownership
SET relationship_type = CASE
  WHEN relationship IN ('parent', 'subsidiary', 'parent_organization') THEN 'control'
  WHEN relationship IN ('shareholder', 'owned_by') THEN 'investment'
  ELSE 'other'
END
WHERE relationship_type IS NULL;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_company_ownership_relationship 
  ON company_ownership(child_brand_id, relationship) 
  WHERE relationship IN ('parent', 'subsidiary', 'parent_organization');

COMMENT ON COLUMN company_ownership.relationship_type IS 'Distinguishes control relationships from investment relationships';
COMMENT ON FUNCTION get_brand_company_info IS 'Returns ownership, people, and valuation data. Only returns true parent relationships (control), NOT shareholders.';