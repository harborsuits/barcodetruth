
-- 1. Create conflict log table
CREATE TABLE IF NOT EXISTS public.company_identifier_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_type text NOT NULL,
  identifier_value text NOT NULL,
  incoming_company_name text,
  existing_company_id uuid REFERENCES public.companies(id),
  existing_company_name text,
  attempted_company_id uuid,
  confidence_score numeric,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.company_identifier_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on conflicts"
  ON public.company_identifier_conflicts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can read conflicts"
  ON public.company_identifier_conflicts
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
  );

-- 2. Replace upsert_company_spine with collision-safe version
CREATE OR REPLACE FUNCTION public.upsert_company_spine(
  p_name text,
  p_wikidata_qid text DEFAULT NULL,
  p_lei text DEFAULT NULL,
  p_sec_cik text DEFAULT NULL,
  p_ticker text DEFAULT NULL,
  p_exchange text DEFAULT NULL,
  p_opencorporates_id text DEFAULT NULL,
  p_website_domain text DEFAULT NULL,
  p_jurisdiction text DEFAULT NULL,
  p_legal_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_conflict_owner uuid;
  v_conflict_name text;
  v_ident_type text;
  v_ident_val text;
BEGIN
  -- Step 1: Try to find existing company by identifiers (priority order)
  IF p_wikidata_qid IS NOT NULL THEN
    SELECT id INTO v_id FROM companies WHERE wikidata_qid = p_wikidata_qid;
  END IF;
  IF v_id IS NULL AND p_lei IS NOT NULL THEN
    SELECT id INTO v_id FROM companies WHERE lei = p_lei;
  END IF;
  IF v_id IS NULL AND p_sec_cik IS NOT NULL THEN
    SELECT id INTO v_id FROM companies WHERE sec_cik = p_sec_cik;
  END IF;
  IF v_id IS NULL AND p_ticker IS NOT NULL THEN
    SELECT id INTO v_id FROM companies WHERE ticker = p_ticker;
  END IF;
  IF v_id IS NULL AND p_opencorporates_id IS NOT NULL THEN
    SELECT id INTO v_id FROM companies WHERE opencorporates_id = p_opencorporates_id;
  END IF;
  IF v_id IS NULL AND p_website_domain IS NOT NULL THEN
    SELECT id INTO v_id FROM companies WHERE website_domain = p_website_domain;
  END IF;
  IF v_id IS NULL AND p_legal_name IS NOT NULL THEN
    SELECT id INTO v_id FROM companies WHERE lower(legal_name) = lower(p_legal_name);
  END IF;
  IF v_id IS NULL AND p_name IS NOT NULL THEN
    SELECT id INTO v_id FROM companies WHERE lower(name) = lower(p_name);
  END IF;

  -- Step 2: If found, check for identifier collisions before updating
  IF v_id IS NOT NULL THEN
    -- Check each incoming identifier against other companies
    IF p_wikidata_qid IS NOT NULL THEN
      SELECT id, name INTO v_conflict_owner, v_conflict_name
        FROM companies WHERE wikidata_qid = p_wikidata_qid AND id != v_id;
      IF v_conflict_owner IS NOT NULL THEN
        INSERT INTO company_identifier_conflicts
          (identifier_type, identifier_value, incoming_company_name, existing_company_id, existing_company_name, attempted_company_id)
        VALUES ('wikidata_qid', p_wikidata_qid, p_name, v_conflict_owner, v_conflict_name, v_id);
        -- Don't apply this identifier
        p_wikidata_qid := NULL;
      END IF;
    END IF;

    IF p_lei IS NOT NULL THEN
      SELECT id, name INTO v_conflict_owner, v_conflict_name
        FROM companies WHERE lei = p_lei AND id != v_id;
      IF v_conflict_owner IS NOT NULL THEN
        INSERT INTO company_identifier_conflicts
          (identifier_type, identifier_value, incoming_company_name, existing_company_id, existing_company_name, attempted_company_id)
        VALUES ('lei', p_lei, p_name, v_conflict_owner, v_conflict_name, v_id);
        p_lei := NULL;
      END IF;
    END IF;

    IF p_sec_cik IS NOT NULL THEN
      SELECT id, name INTO v_conflict_owner, v_conflict_name
        FROM companies WHERE sec_cik = p_sec_cik AND id != v_id;
      IF v_conflict_owner IS NOT NULL THEN
        INSERT INTO company_identifier_conflicts
          (identifier_type, identifier_value, incoming_company_name, existing_company_id, existing_company_name, attempted_company_id)
        VALUES ('sec_cik', p_sec_cik, p_name, v_conflict_owner, v_conflict_name, v_id);
        p_sec_cik := NULL;
      END IF;
    END IF;

    IF p_opencorporates_id IS NOT NULL THEN
      SELECT id, name INTO v_conflict_owner, v_conflict_name
        FROM companies WHERE opencorporates_id = p_opencorporates_id AND id != v_id;
      IF v_conflict_owner IS NOT NULL THEN
        INSERT INTO company_identifier_conflicts
          (identifier_type, identifier_value, incoming_company_name, existing_company_id, existing_company_name, attempted_company_id)
        VALUES ('opencorporates_id', p_opencorporates_id, p_name, v_conflict_owner, v_conflict_name, v_id);
        p_opencorporates_id := NULL;
      END IF;
    END IF;

    -- Now safe to update
    UPDATE companies SET
      name = COALESCE(p_name, name),
      wikidata_qid = COALESCE(p_wikidata_qid, wikidata_qid),
      lei = COALESCE(p_lei, lei),
      sec_cik = COALESCE(p_sec_cik, sec_cik),
      ticker = COALESCE(p_ticker, ticker),
      exchange = COALESCE(p_exchange, exchange),
      opencorporates_id = COALESCE(p_opencorporates_id, opencorporates_id),
      website_domain = COALESCE(p_website_domain, website_domain),
      jurisdiction = COALESCE(p_jurisdiction, jurisdiction),
      legal_name = COALESCE(p_legal_name, legal_name),
      updated_at = now()
    WHERE id = v_id;

    RETURN v_id;
  END IF;

  -- Step 3: No match found — create new company
  INSERT INTO companies (name, wikidata_qid, lei, sec_cik, ticker, exchange, opencorporates_id, website_domain, jurisdiction, legal_name)
  VALUES (p_name, p_wikidata_qid, p_lei, p_sec_cik, p_ticker, p_exchange, p_opencorporates_id, p_website_domain, p_jurisdiction, p_legal_name)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
