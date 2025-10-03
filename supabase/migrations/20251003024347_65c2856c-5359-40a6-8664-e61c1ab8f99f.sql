
-- Fix Security Definer Views by adding SECURITY INVOKER
-- This ensures views respect RLS policies of the querying user, not the view creator

-- Drop and recreate brand_evidence_independent with SECURITY INVOKER
DROP VIEW IF EXISTS public.brand_evidence_independent;

CREATE VIEW public.brand_evidence_independent
WITH (security_invoker = true)
AS
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
    (be.verification)::text AS verification
  FROM event_sources es
  JOIN brand_events be ON be.event_id = es.event_id
  WHERE es.source_url IS NOT NULL
), 
ranked AS (
  SELECT 
    src.source_id,
    src.event_id,
    src.url,
    src.registrable_domain,
    src.domain_owner,
    src.domain_kind,
    src.source_name,
    src.source_date,
    src.archive_url,
    src.snippet,
    src.day_bucket,
    src.brand_id,
    src.category,
    src.verification,
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

-- Drop and recreate product_claims_moderator with SECURITY INVOKER
DROP VIEW IF EXISTS public.product_claims_moderator;

CREATE VIEW public.product_claims_moderator
WITH (security_invoker = true)
AS
SELECT 
  c.id,
  c.barcode_ean13,
  c.claimed_brand_id,
  c.product_name,
  c.source_hint,
  c.confidence,
  c.status,
  c.created_by,
  c.created_at,
  c.moderated_by,
  c.moderated_at,
  c.rejection_reason,
  COALESCE(SUM(v.vote), 0) AS score,
  COUNT(v.*) FILTER (WHERE v.vote = 1) AS upvotes,
  COUNT(v.*) FILTER (WHERE v.vote = -1) AS downvotes
FROM product_claims c
LEFT JOIN product_claim_votes v ON v.claim_id = c.id
GROUP BY c.id;
