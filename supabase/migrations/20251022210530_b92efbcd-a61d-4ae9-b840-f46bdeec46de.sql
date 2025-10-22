-- Phase 0: Schema Hardening for Enrichment Pipeline
-- Drop old enrichment_runs table structure and create new observability table
DROP TABLE IF EXISTS enrichment_runs CASCADE;

CREATE TABLE enrichment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  task text NOT NULL,
  rows_written integer DEFAULT 0,
  duration_ms integer,
  status text NOT NULL CHECK (status IN ('success','partial','failed')),
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on enrichment_runs
ALTER TABLE enrichment_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view enrichment runs"
ON enrichment_runs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage enrichment runs"
ON enrichment_runs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX idx_enrichment_runs_brand_task ON enrichment_runs(brand_id, task);
CREATE INDEX idx_enrichment_runs_finished_at ON enrichment_runs(finished_at DESC);

-- Add people_role enum for type safety
DO $$ BEGIN
  CREATE TYPE people_role AS ENUM ('chief_executive_officer','founder','chairperson');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enhance company_people with new columns
ALTER TABLE company_people
  ADD COLUMN IF NOT EXISTS wikipedia_url text,
  ADD COLUMN IF NOT EXISTS image_file text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS source_name text DEFAULT 'Wikidata',
  ADD COLUMN IF NOT EXISTS source_ref text;

-- Add unique constraint for idempotency (drop first if exists)
DO $$ BEGIN
  ALTER TABLE company_people DROP CONSTRAINT IF EXISTS company_people_unique_role;
  ALTER TABLE company_people ADD CONSTRAINT company_people_unique_role UNIQUE (company_id, role);
EXCEPTION WHEN others THEN NULL;
END $$;

-- Enhance company_shareholders with normalization columns
ALTER TABLE company_shareholders
  ADD COLUMN IF NOT EXISTS holder_name_raw text,
  ADD COLUMN IF NOT EXISTS is_asset_manager boolean DEFAULT false;

-- Add constraint on percent_owned (drop first if exists)
DO $$ BEGIN
  ALTER TABLE company_shareholders DROP CONSTRAINT IF EXISTS company_shareholders_pct_chk;
  ALTER TABLE company_shareholders ADD CONSTRAINT company_shareholders_pct_chk 
    CHECK (percent_owned >= 0 AND percent_owned <= 100);
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add stronger constraints on company_ownership (drop first if exists)
DO $$ BEGIN
  ALTER TABLE company_ownership DROP CONSTRAINT IF EXISTS company_ownership_rel_chk;
  ALTER TABLE company_ownership ADD CONSTRAINT company_ownership_rel_chk
    CHECK (relationship_type IN ('parent','subsidiary','parent_organization'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- Trigger to prevent asset managers as parents
CREATE OR REPLACE FUNCTION prevent_asset_manager_parent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.relationship_type = 'parent' AND EXISTS (
    SELECT 1 FROM company_shareholders 
    WHERE directory_id = NEW.parent_company_id 
    AND is_asset_manager = true
  ) THEN
    RAISE EXCEPTION 'Cannot set asset manager as parent company';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_asset_manager_parent_trigger ON company_ownership;
CREATE TRIGGER prevent_asset_manager_parent_trigger
  BEFORE INSERT OR UPDATE ON company_ownership
  FOR EACH ROW
  EXECUTE FUNCTION prevent_asset_manager_parent();