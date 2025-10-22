-- 1. Backfill old role strings to canonical snake_case
UPDATE company_people SET role='chief_executive_officer' WHERE role IN ('CEO','Chief Executive Officer');
UPDATE company_people SET role='chairperson' WHERE role IN ('Chairperson','Chairman','Chair');
UPDATE company_people SET role='founder' WHERE role IN ('Founder');

-- 2. Add unique constraints for data hygiene
ALTER TABLE company_people 
  DROP CONSTRAINT IF EXISTS company_people_company_person_role_unique;

ALTER TABLE company_people 
  ADD CONSTRAINT company_people_company_person_role_unique 
  UNIQUE (company_id, person_qid, role);

-- 3. Ensure brand_data_mappings has unique constraint (if not exists)
ALTER TABLE brand_data_mappings 
  DROP CONSTRAINT IF EXISTS brand_data_mappings_brand_source_label_unique;

ALTER TABLE brand_data_mappings 
  ADD CONSTRAINT brand_data_mappings_brand_source_label_unique 
  UNIQUE (brand_id, source, label);

-- 4. Add confidence scoring to company_people
ALTER TABLE company_people 
  ADD COLUMN IF NOT EXISTS confidence numeric DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1);

-- Update confidence based on data quality
UPDATE company_people 
SET confidence = CASE
  WHEN person_qid IS NOT NULL AND image_url IS NOT NULL THEN 0.9
  WHEN person_qid IS NOT NULL THEN 0.8
  ELSE 0.6
END;

-- 5. Create enrichment runs tracking table
CREATE TABLE IF NOT EXISTS enrichment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  run_at timestamp with time zone DEFAULT now(),
  parent_found boolean DEFAULT false,
  people_added integer DEFAULT 0,
  ticker_added boolean DEFAULT false,
  description_length integer DEFAULT 0,
  logo_found boolean DEFAULT false,
  country_found boolean DEFAULT false,
  properties_found text[] DEFAULT '{}',
  error_message text,
  duration_ms integer
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_enrichment_runs_brand_id ON enrichment_runs(brand_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_runs_run_at ON enrichment_runs(run_at DESC);

-- RLS policies for enrichment_runs
ALTER TABLE enrichment_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view enrichment runs" ON enrichment_runs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage enrichment runs" ON enrichment_runs
  FOR ALL USING (true) WITH CHECK (true);