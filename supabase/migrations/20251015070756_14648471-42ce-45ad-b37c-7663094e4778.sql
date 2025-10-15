-- 0) Schema guardrails: indexes for provenance and idempotency
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_sources_event_canonical
  ON public.event_sources (event_id, canonical_url);

CREATE INDEX IF NOT EXISTS idx_event_sources_primary
  ON public.event_sources (event_id, is_primary DESC, created_at);

-- 2) Backfill existing events from raw_data (idempotent)
-- OSHA (labor)
INSERT INTO public.event_sources (event_id, source_name, title, canonical_url, owner_domain, is_primary, link_kind)
SELECT
  be.event_id,
  'OSHA' AS source_name,
  COALESCE(be.title, be.raw_data->>'violation_description', be.raw_data->>'case_name', 'OSHA enforcement record') AS title,
  COALESCE(be.raw_data->>'inspection_url', be.raw_data->>'public_url', be.raw_data->>'url', be.source_url) AS canonical_url,
  NULLIF(regexp_replace(split_part(COALESCE(be.raw_data->>'inspection_url', be.raw_data->>'public_url', be.raw_data->>'url', be.source_url), '/', 3), '^www\.', ''), '') AS owner_domain,
  TRUE AS is_primary,
  'database' AS link_kind
FROM public.brand_events be
LEFT JOIN public.event_sources es ON es.event_id = be.event_id AND es.is_primary = TRUE
WHERE be.verification = 'official'::verification_level
  AND be.category = 'labor'::event_category
  AND es.event_id IS NULL
  AND COALESCE(be.raw_data->>'inspection_url', be.raw_data->>'public_url', be.raw_data->>'url', be.source_url) IS NOT NULL
ON CONFLICT (event_id, canonical_url) DO NOTHING;

-- EPA (environment)
INSERT INTO public.event_sources (event_id, source_name, title, canonical_url, owner_domain, is_primary, link_kind)
SELECT
  be.event_id,
  'EPA' AS source_name,
  COALESCE(be.title, be.raw_data->>'action', be.raw_data->>'title', 'EPA action') AS title,
  COALESCE(be.raw_data->>'document_url', be.raw_data->>'canonical_url', be.raw_data->>'url', be.source_url) AS canonical_url,
  NULLIF(regexp_replace(split_part(COALESCE(be.raw_data->>'document_url', be.raw_data->>'canonical_url', be.raw_data->>'url', be.source_url), '/', 3), '^www\.', ''), '') AS owner_domain,
  TRUE AS is_primary,
  'database' AS link_kind
FROM public.brand_events be
LEFT JOIN public.event_sources es ON es.event_id = be.event_id AND es.is_primary = TRUE
WHERE be.verification = 'official'::verification_level
  AND be.category = 'environment'::event_category
  AND es.event_id IS NULL
  AND COALESCE(be.raw_data->>'document_url', be.raw_data->>'canonical_url', be.raw_data->>'url', be.source_url) IS NOT NULL
ON CONFLICT (event_id, canonical_url) DO NOTHING;

-- FDA (social)
INSERT INTO public.event_sources (event_id, source_name, title, canonical_url, owner_domain, is_primary, link_kind)
SELECT
  be.event_id,
  'FDA' AS source_name,
  COALESCE(be.title, be.raw_data->>'recall_initiation_reason', be.raw_data->>'title', 'FDA recall') AS title,
  COALESCE(be.raw_data->>'recall_url', be.raw_data->>'canonical_url', be.raw_data->>'url', be.source_url) AS canonical_url,
  NULLIF(regexp_replace(split_part(COALESCE(be.raw_data->>'recall_url', be.raw_data->>'canonical_url', be.raw_data->>'url', be.source_url), '/', 3), '^www\.', ''), '') AS owner_domain,
  TRUE AS is_primary,
  'database' AS link_kind
FROM public.brand_events be
LEFT JOIN public.event_sources es ON es.event_id = be.event_id AND es.is_primary = TRUE
WHERE be.verification = 'official'::verification_level
  AND be.category = 'social'::event_category
  AND es.event_id IS NULL
  AND COALESCE(be.raw_data->>'recall_url', be.raw_data->>'canonical_url', be.raw_data->>'url', be.source_url) IS NOT NULL
ON CONFLICT (event_id, canonical_url) DO NOTHING;

-- FEC (politics)
INSERT INTO public.event_sources (event_id, source_name, title, canonical_url, owner_domain, is_primary, link_kind)
SELECT
  be.event_id,
  'FEC' AS source_name,
  COALESCE(be.title, 'FEC filings') AS title,
  COALESCE(be.raw_data->>'filing_url', be.raw_data->>'canonical_url', be.raw_data->>'url', be.source_url) AS canonical_url,
  NULLIF(regexp_replace(split_part(COALESCE(be.raw_data->>'filing_url', be.raw_data->>'canonical_url', be.raw_data->>'url', be.source_url), '/', 3), '^www\.', ''), '') AS owner_domain,
  TRUE AS is_primary,
  'database' AS link_kind
FROM public.brand_events be
LEFT JOIN public.event_sources es ON es.event_id = be.event_id AND es.is_primary = TRUE
WHERE be.verification = 'official'::verification_level
  AND be.category = 'politics'::event_category
  AND es.event_id IS NULL
  AND COALESCE(be.raw_data->>'filing_url', be.raw_data->>'canonical_url', be.raw_data->>'url', be.source_url) IS NOT NULL
ON CONFLICT (event_id, canonical_url) DO NOTHING;