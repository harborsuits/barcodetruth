-- Recreate brand_evidence_view to exclude test events
CREATE VIEW brand_evidence_view AS
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
  WHERE es.source_url IS NOT NULL
    AND be.is_test = FALSE
), 
ranked AS (
  SELECT 
    src.*,
    row_number() OVER (
      PARTITION BY src.brand_id, src.category, src.domain_owner, src.day_bucket 
      ORDER BY verification_rank(src.verification), 
        CASE src.domain_kind
          WHEN 'publisher' THEN 0
          WHEN 'network' THEN 1
          ELSE 2
        END, 
        src.source_date
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

-- Update brand_evidence_independent to exclude test events
DROP VIEW IF EXISTS brand_evidence_independent CASCADE;

CREATE VIEW brand_evidence_independent AS
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
  WHERE es.source_url IS NOT NULL
    AND be.is_test = FALSE
), 
ranked AS (
  SELECT 
    src.*,
    row_number() OVER (
      PARTITION BY src.brand_id, src.category, src.domain_owner, src.day_bucket 
      ORDER BY verification_rank(src.verification), 
        CASE src.domain_kind
          WHEN 'publisher' THEN 0
          WHEN 'network' THEN 1
          ELSE 2
        END, 
        src.source_date
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