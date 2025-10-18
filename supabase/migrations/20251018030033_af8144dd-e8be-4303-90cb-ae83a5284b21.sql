-- Fix brand_evidence_view and brand_evidence_independent to use canonical_url OR source_url
-- The old views filtered for source_url IS NOT NULL, but all data has canonical_url instead

DROP VIEW IF EXISTS public.brand_evidence_view CASCADE;
DROP VIEW IF EXISTS public.brand_evidence_independent CASCADE;

-- Recreate brand_evidence_independent with fixed URL filter
CREATE VIEW public.brand_evidence_independent AS
WITH src AS (
  SELECT 
    es.id AS source_id,
    es.event_id,
    COALESCE(es.canonical_url, es.source_url) AS url,
    es.registrable_domain,
    es.domain_owner,
    es.domain_kind,
    es.source_name,
    es.source_date,
    es.archive_url,
    es.quote AS snippet,
    es.day_bucket,
    be.brand_id,
    be.category,
    be.verification::text AS verification
  FROM event_sources es
  JOIN brand_events be ON be.event_id = es.event_id
  WHERE 
    -- Fixed: Accept either canonical_url OR source_url
    (es.canonical_url IS NOT NULL OR es.source_url IS NOT NULL)
    AND be.is_test = false
),
ranked AS (
  SELECT 
    *,
    row_number() OVER (
      PARTITION BY brand_id, category, domain_owner, day_bucket 
      ORDER BY 
        verification_rank(verification),
        CASE domain_kind
          WHEN 'publisher' THEN 0
          WHEN 'network' THEN 1
          ELSE 2
        END,
        source_date
    ) AS rnk
  FROM src
)
SELECT 
  source_id AS id,
  event_id,
  brand_id,
  category,
  verification,
  source_name,
  url AS source_url,
  archive_url,
  source_date,
  snippet,
  domain_owner,
  domain_kind,
  registrable_domain
FROM ranked
WHERE rnk = 1;

-- Recreate brand_evidence_view (same fix)
CREATE VIEW public.brand_evidence_view AS
WITH src AS (
  SELECT 
    es.id AS source_id,
    es.event_id,
    COALESCE(es.canonical_url, es.source_url) AS url,
    es.registrable_domain,
    es.domain_owner,
    es.domain_kind,
    es.source_name,
    es.source_date,
    es.archive_url,
    es.quote AS snippet,
    es.day_bucket,
    be.brand_id,
    be.category,
    be.verification::text AS verification
  FROM event_sources es
  JOIN brand_events be ON be.event_id = es.event_id
  WHERE 
    -- Fixed: Accept either canonical_url OR source_url
    (es.canonical_url IS NOT NULL OR es.source_url IS NOT NULL)
    AND be.is_test = false
)
SELECT 
  source_id AS id,
  event_id,
  brand_id,
  category,
  verification,
  source_name,
  url AS source_url,
  archive_url,
  source_date,
  snippet,
  domain_owner,
  domain_kind,
  registrable_domain
FROM src;

-- Grant SELECT to authenticated and anon roles
GRANT SELECT ON public.brand_evidence_view TO authenticated, anon;
GRANT SELECT ON public.brand_evidence_independent TO authenticated, anon;