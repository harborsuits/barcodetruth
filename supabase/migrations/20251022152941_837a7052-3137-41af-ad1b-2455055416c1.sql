-- 1) First, find and clean up any invalid relationships
-- Delete rows with invalid relationships before adding constraint
DELETE FROM company_ownership 
WHERE relationship NOT IN ('parent','subsidiary','parent_organization','owned_by')
  OR relationship IS NULL;

-- 2) Now add the constraint
ALTER TABLE company_ownership
  ADD CONSTRAINT company_ownership_relation_chk
  CHECK (relationship IN ('parent','subsidiary','parent_organization','owned_by'));

-- 3) Trigger to reject invalid relationships going forward
CREATE OR REPLACE FUNCTION trg_company_ownership_only_control()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.relationship NOT IN ('parent','subsidiary','parent_organization','owned_by') THEN
    RAISE EXCEPTION 'Invalid relationship for control chain: %', NEW.relationship;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS company_ownership_only_control ON company_ownership;
CREATE TRIGGER company_ownership_only_control
BEFORE INSERT OR UPDATE ON company_ownership
FOR EACH ROW EXECUTE FUNCTION trg_company_ownership_only_control();

-- 4) Clean view for control paths (without percent_owned which doesn't exist)
CREATE OR REPLACE VIEW v_brand_parent AS
SELECT co.child_brand_id AS brand_id,
       co.parent_company_id AS company_id,
       co.relationship, co.confidence, co.source
FROM company_ownership co
WHERE co.relationship IN ('parent','subsidiary','parent_organization','owned_by')
  AND co.confidence >= 0.7;

-- 5) Backfill public company flags and tickers for known entities
UPDATE companies SET is_public = true, ticker = 'SBUX', exchange = 'NASDAQ'
WHERE name = 'Starbucks Corporation';

UPDATE companies SET is_public = true, ticker = 'KR', exchange = 'NYSE'
WHERE name = 'The Kroger Co.';

UPDATE companies SET is_public = false
WHERE name = 'Publix Super Markets, Inc.';

-- 6) Ensure RPC has proper permissions (idempotent)
GRANT EXECUTE ON FUNCTION get_brand_ownership(uuid) TO anon, authenticated;