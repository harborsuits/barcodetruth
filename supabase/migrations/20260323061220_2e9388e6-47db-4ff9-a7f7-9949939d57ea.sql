-- Add multi-identifier columns to companies table for cross-source resolution
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS lei text,
  ADD COLUMN IF NOT EXISTS sec_cik text,
  ADD COLUMN IF NOT EXISTS opencorporates_id text,
  ADD COLUMN IF NOT EXISTS jurisdiction text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS official_website text,
  ADD COLUMN IF NOT EXISTS founded_year integer,
  ADD COLUMN IF NOT EXISTS identifiers_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_sources text[] DEFAULT '{}';

-- Unique indexes on external identifiers (partial — only when non-null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_lei ON public.companies (lei) WHERE lei IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_sec_cik ON public.companies (sec_cik) WHERE sec_cik IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_opencorporates_id ON public.companies (opencorporates_id) WHERE opencorporates_id IS NOT NULL;

-- Index on official_website domain for domain-based resolution
CREATE INDEX IF NOT EXISTS idx_companies_official_website ON public.companies (official_website) WHERE official_website IS NOT NULL;

-- Function: resolve a company by any identifier (returns company_id)
CREATE OR REPLACE FUNCTION public.resolve_company_by_identifier(
  p_wikidata_qid text DEFAULT NULL,
  p_lei text DEFAULT NULL,
  p_sec_cik text DEFAULT NULL,
  p_ticker text DEFAULT NULL,
  p_opencorporates_id text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_legal_name text DEFAULT NULL
) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT id FROM (
    SELECT id, 1 AS prio FROM companies WHERE p_wikidata_qid IS NOT NULL AND wikidata_qid = p_wikidata_qid
    UNION ALL
    SELECT id, 2 FROM companies WHERE p_lei IS NOT NULL AND lei = p_lei
    UNION ALL
    SELECT id, 3 FROM companies WHERE p_sec_cik IS NOT NULL AND sec_cik = p_sec_cik
    UNION ALL
    SELECT id, 4 FROM companies WHERE p_ticker IS NOT NULL AND ticker = p_ticker AND is_public = true
    UNION ALL
    SELECT id, 5 FROM companies WHERE p_opencorporates_id IS NOT NULL AND opencorporates_id = p_opencorporates_id
    UNION ALL
    SELECT id, 6 FROM companies WHERE p_domain IS NOT NULL AND official_website ILIKE '%' || p_domain || '%'
    UNION ALL
    SELECT id, 7 FROM companies WHERE p_legal_name IS NOT NULL AND lower(legal_name) = lower(p_legal_name)
  ) ranked
  ORDER BY prio
  LIMIT 1;
$$;

-- Function: upsert a company with identifier merging
CREATE OR REPLACE FUNCTION public.upsert_company_spine(
  p_name text,
  p_wikidata_qid text DEFAULT NULL,
  p_lei text DEFAULT NULL,
  p_sec_cik text DEFAULT NULL,
  p_ticker text DEFAULT NULL,
  p_exchange text DEFAULT NULL,
  p_opencorporates_id text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_legal_name text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_is_public boolean DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_jurisdiction text DEFAULT NULL,
  p_founded_year integer DEFAULT NULL,
  p_source text DEFAULT 'manual'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id uuid;
  v_result_id uuid;
BEGIN
  v_existing_id := resolve_company_by_identifier(
    p_wikidata_qid, p_lei, p_sec_cik, p_ticker, p_opencorporates_id, p_domain, p_legal_name
  );

  IF v_existing_id IS NOT NULL THEN
    UPDATE companies SET
      wikidata_qid = COALESCE(p_wikidata_qid, wikidata_qid),
      lei = COALESCE(p_lei, lei),
      sec_cik = COALESCE(p_sec_cik, sec_cik),
      opencorporates_id = COALESCE(p_opencorporates_id, opencorporates_id),
      ticker = COALESCE(p_ticker, ticker),
      exchange = COALESCE(p_exchange, exchange),
      official_website = COALESCE(p_domain, official_website),
      legal_name = COALESCE(p_legal_name, legal_name),
      country = COALESCE(p_country, country),
      is_public = COALESCE(p_is_public, is_public),
      description = COALESCE(p_description, description),
      logo_url = COALESCE(p_logo_url, logo_url),
      jurisdiction = COALESCE(p_jurisdiction, jurisdiction),
      founded_year = COALESCE(p_founded_year, founded_year),
      identifiers_updated_at = now(),
      identity_sources = array(
        SELECT DISTINCT unnest(COALESCE(identity_sources, '{}') || ARRAY[p_source])
      ),
      updated_at = now()
    WHERE id = v_existing_id;
    RETURN v_existing_id;
  ELSE
    INSERT INTO companies (
      name, wikidata_qid, lei, sec_cik, opencorporates_id,
      ticker, exchange, official_website, legal_name,
      country, is_public, description, logo_url,
      jurisdiction, founded_year, identifiers_updated_at, identity_sources
    ) VALUES (
      p_name, p_wikidata_qid, p_lei, p_sec_cik, p_opencorporates_id,
      p_ticker, p_exchange, p_domain, p_legal_name,
      p_country, p_is_public, p_description, p_logo_url,
      p_jurisdiction, p_founded_year, now(), ARRAY[p_source]
    ) RETURNING id INTO v_result_id;
    RETURN v_result_id;
  END IF;
END;
$$;

-- View: company identity completeness
CREATE OR REPLACE VIEW public.v_company_identity_completeness AS
SELECT
  c.id, c.name,
  c.wikidata_qid IS NOT NULL AS has_wikidata,
  c.lei IS NOT NULL AS has_lei,
  c.sec_cik IS NOT NULL AS has_sec_cik,
  c.opencorporates_id IS NOT NULL AS has_opencorporates,
  c.ticker IS NOT NULL AS has_ticker,
  c.official_website IS NOT NULL AS has_website,
  c.legal_name IS NOT NULL AS has_legal_name,
  (
    (c.wikidata_qid IS NOT NULL)::int +
    (c.lei IS NOT NULL)::int +
    (c.sec_cik IS NOT NULL)::int +
    (c.opencorporates_id IS NOT NULL)::int +
    (c.ticker IS NOT NULL)::int +
    (c.official_website IS NOT NULL)::int +
    (c.legal_name IS NOT NULL)::int
  ) AS identifier_count,
  c.identity_sources,
  c.identifiers_updated_at,
  c.is_public
FROM public.companies c
ORDER BY identifier_count DESC;