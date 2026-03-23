-- 1. Partial unique indexes to prevent NULL duplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_lei_unique
ON companies (lei) WHERE lei IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_sec_cik_unique
ON companies (sec_cik) WHERE sec_cik IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_opencorporates_unique
ON companies (opencorporates_id) WHERE opencorporates_id IS NOT NULL;

-- 2. Add website_domain column for exact matching
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website_domain text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_website_domain_unique
ON companies (website_domain) WHERE website_domain IS NOT NULL;

-- 3. Backfill website_domain from official_website
UPDATE companies
SET website_domain = lower(regexp_replace(
  regexp_replace(split_part(official_website, '//', 2), '/.*$', ''),
  '^www\.', ''
))
WHERE official_website IS NOT NULL AND website_domain IS NULL;

-- 4. Update resolver to use exact domain match
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
    SELECT id, 6 FROM companies WHERE p_domain IS NOT NULL AND website_domain = lower(regexp_replace(regexp_replace(split_part(p_domain, '//', 2), '/.*$', ''), '^www\.', ''))
    UNION ALL
    SELECT id, 7 FROM companies WHERE p_legal_name IS NOT NULL AND lower(legal_name) = lower(p_legal_name)
  ) ranked
  ORDER BY prio
  LIMIT 1;
$$;

-- 5. Update upsert_company_spine to populate website_domain
CREATE OR REPLACE FUNCTION public.upsert_company_spine(
  p_name text,
  p_wikidata_qid text DEFAULT NULL, p_lei text DEFAULT NULL,
  p_sec_cik text DEFAULT NULL, p_ticker text DEFAULT NULL,
  p_exchange text DEFAULT NULL, p_opencorporates_id text DEFAULT NULL,
  p_domain text DEFAULT NULL, p_legal_name text DEFAULT NULL,
  p_country text DEFAULT NULL, p_is_public boolean DEFAULT NULL,
  p_description text DEFAULT NULL, p_logo_url text DEFAULT NULL,
  p_jurisdiction text DEFAULT NULL, p_founded_year integer DEFAULT NULL,
  p_source text DEFAULT 'manual'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id uuid;
  v_result_id uuid;
  v_domain text;
BEGIN
  v_domain := CASE WHEN p_domain IS NOT NULL
    THEN lower(regexp_replace(regexp_replace(split_part(p_domain, '//', 2), '/.*$', ''), '^www\.', ''))
    ELSE NULL END;

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
      website_domain = COALESCE(v_domain, website_domain),
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
      ticker, exchange, official_website, website_domain, legal_name,
      country, is_public, description, logo_url,
      jurisdiction, founded_year, identifiers_updated_at, identity_sources
    ) VALUES (
      p_name, p_wikidata_qid, p_lei, p_sec_cik, p_opencorporates_id,
      p_ticker, p_exchange, p_domain, v_domain, p_legal_name,
      p_country, p_is_public, p_description, p_logo_url,
      p_jurisdiction, p_founded_year, now(), ARRAY[p_source]
    ) RETURNING id INTO v_result_id;
    RETURN v_result_id;
  END IF;
END;
$$;