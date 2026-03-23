DROP VIEW IF EXISTS public.v_company_identity_completeness;

CREATE VIEW public.v_company_identity_completeness AS
SELECT
  id,
  name,
  wikidata_qid,
  lei,
  sec_cik,
  opencorporates_id,
  website_domain,
  ticker,
  identity_sources,
  identifiers_updated_at,
  (
    (CASE WHEN wikidata_qid IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN lei IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN sec_cik IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN opencorporates_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN website_domain IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN ticker IS NOT NULL THEN 1 ELSE 0 END)
  ) AS identifier_count,
  ROUND(
    (
      (CASE WHEN wikidata_qid IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN lei IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN sec_cik IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN opencorporates_id IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN website_domain IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ticker IS NOT NULL THEN 1 ELSE 0 END)
    )::numeric / 6.0 * 100
  ) AS identifier_coverage_pct
FROM public.companies;