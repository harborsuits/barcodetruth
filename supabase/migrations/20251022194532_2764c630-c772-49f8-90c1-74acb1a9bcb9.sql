-- ====================
-- WALMART STANDARD: DB HARDENING
-- ====================

-- 1) Coverage tracking view
CREATE OR REPLACE VIEW brand_profile_coverage AS
SELECT
  b.id AS brand_id,
  b.name,
  (b.description IS NOT NULL AND LENGTH(b.description) > 40) AS has_description,
  EXISTS (
    SELECT 1 FROM company_ownership co 
    WHERE co.child_brand_id = b.id 
    AND co.relationship_type IN ('parent', 'subsidiary', 'parent_organization')
  ) AS has_parent_company,
  EXISTS (
    SELECT 1 FROM company_people kp 
    JOIN company_ownership co ON co.parent_company_id = kp.company_id
    WHERE co.child_brand_id = b.id
  ) AS has_key_people,
  (
    SELECT COUNT(*) FROM company_shareholders sh 
    JOIN company_ownership co ON co.parent_company_id = sh.company_id
    WHERE co.child_brand_id = b.id AND sh.holder_type = 'institutional'
  ) >= 5 AS has_shareholders,
  (
    SELECT COUNT(DISTINCT 
      CASE 
        WHEN score_labor IS NOT NULL THEN 'labor'
        WHEN score_environment IS NOT NULL THEN 'environment'
        WHEN score_politics IS NOT NULL THEN 'politics'
        WHEN score_social IS NOT NULL THEN 'social'
      END
    ) FROM brand_scores s WHERE s.brand_id = b.id
  ) = 4 AS has_all_scores
FROM brands b
WHERE b.is_active = true;

-- 2) Prevent asset managers from being set as parent companies
CREATE OR REPLACE FUNCTION forbid_asset_managers_as_parents()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Check if the parent company is a known asset manager
  IF EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = NEW.parent_company_id
    AND (
      c.name ILIKE '%BlackRock%' 
      OR c.name ILIKE '%Vanguard%' 
      OR c.name ILIKE '%State Street%'
      OR c.name ILIKE '%Fidelity%'
      OR c.name ILIKE '%Invesco%'
    )
  ) THEN
    RAISE EXCEPTION 'Asset managers cannot be set as parent companies. Use company_shareholders table instead.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_no_asset_manager_parent ON company_ownership;
CREATE TRIGGER trg_no_asset_manager_parent
BEFORE INSERT OR UPDATE ON company_ownership
FOR EACH ROW EXECUTE FUNCTION forbid_asset_managers_as_parents();

-- 3) Ensure default scores function
CREATE OR REPLACE FUNCTION ensure_default_scores(_brand_id UUID)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO brand_scores (brand_id, score_labor, score_environment, score_politics, score_social)
  VALUES (_brand_id, 50, 50, 50, 50)
  ON CONFLICT (brand_id) 
  DO UPDATE SET
    score_labor = COALESCE(brand_scores.score_labor, 50),
    score_environment = COALESCE(brand_scores.score_environment, 50),
    score_politics = COALESCE(brand_scores.score_politics, 50),
    score_social = COALESCE(brand_scores.score_social, 50);
$$;

-- 4) Auto-create default scores for new brands
CREATE OR REPLACE FUNCTION auto_create_default_scores()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM ensure_default_scores(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_default_scores ON brands;
CREATE TRIGGER trg_auto_default_scores
AFTER INSERT ON brands
FOR EACH ROW EXECUTE FUNCTION auto_create_default_scores();

-- 5) Backfill existing brands with default scores
DO $$
DECLARE
  _brand RECORD;
BEGIN
  FOR _brand IN SELECT id FROM brands WHERE is_active = true LOOP
    PERFORM ensure_default_scores(_brand.id);
  END LOOP;
END $$;

-- 6) Add RLS for coverage view
ALTER VIEW brand_profile_coverage SET (security_invoker = true);

-- 7) Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_company_ownership_child_brand ON company_ownership(child_brand_id);
CREATE INDEX IF NOT EXISTS idx_company_ownership_parent_company ON company_ownership(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_company_people_company ON company_people(company_id);
CREATE INDEX IF NOT EXISTS idx_company_shareholders_company ON company_shareholders(company_id);

COMMENT ON VIEW brand_profile_coverage IS 'Tracks completion of Walmart standard features for all brands';
COMMENT ON FUNCTION forbid_asset_managers_as_parents() IS 'Prevents asset managers from being incorrectly classified as parent companies';
COMMENT ON FUNCTION ensure_default_scores(_brand_id UUID) IS 'Ensures all brands have default scores of 50 for all categories';