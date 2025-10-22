-- 1) Asset managers lookup table
CREATE TABLE IF NOT EXISTS asset_managers (
  name text PRIMARY KEY
);

INSERT INTO asset_managers(name) VALUES
  ('BlackRock'), ('Vanguard'), ('State Street'), ('Fidelity'),
  ('Invesco'), ('Capital Group'), ('T. Rowe Price'),
  ('JPMorgan'), ('Amundi'), ('Legal & General'), ('Northern Trust'),
  ('Charles Schwab'), ('Goldman Sachs'), ('Morgan Stanley'), ('UBS')
ON CONFLICT DO NOTHING;

-- 2) Fix asset-manager prevention trigger
CREATE OR REPLACE FUNCTION prevent_asset_manager_parent()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_name text;
BEGIN
  SELECT name INTO parent_name FROM companies WHERE id = NEW.parent_company_id;
  IF parent_name IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM asset_managers am
    WHERE parent_name ILIKE '%' || am.name || '%'
  ) THEN
    RAISE EXCEPTION 'Cannot set asset manager (%) as parent company. Use company_shareholders instead.', parent_name;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS prevent_asset_manager_parent_trigger ON company_ownership;
CREATE TRIGGER prevent_asset_manager_parent_trigger
  BEFORE INSERT OR UPDATE ON company_ownership
  FOR EACH ROW EXECUTE FUNCTION prevent_asset_manager_parent();

-- 3) Deduplicate company_people (keep most recent)
DELETE FROM company_people
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY company_id, role
             ORDER BY last_verified_at DESC NULLS LAST, created_at DESC NULLS LAST
           ) as rn
    FROM company_people
  ) t
  WHERE rn > 1
);

-- 4) Add compound uniqueness constraints
ALTER TABLE company_ownership
  DROP CONSTRAINT IF EXISTS company_ownership_unique_pair,
  ADD CONSTRAINT company_ownership_unique_pair
  UNIQUE (parent_company_id, child_brand_id);

ALTER TABLE company_people
  DROP CONSTRAINT IF EXISTS company_people_unique_role,
  ADD CONSTRAINT company_people_unique_role
  UNIQUE (company_id, role);

-- 5) Add indexes on enrichment_runs
CREATE INDEX IF NOT EXISTS idx_runs_finished_at ON enrichment_runs(finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_task ON enrichment_runs(task);
CREATE INDEX IF NOT EXISTS idx_runs_status ON enrichment_runs(status);

-- 6) Unique constraint and index on companies.wikidata_qid
ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_qid_unique,
  ADD CONSTRAINT companies_qid_unique UNIQUE (wikidata_qid);

CREATE INDEX IF NOT EXISTS idx_companies_qid ON companies(wikidata_qid);