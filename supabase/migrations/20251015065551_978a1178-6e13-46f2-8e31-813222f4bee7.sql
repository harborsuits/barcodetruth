-- 1) Add is_primary column to event_sources for tracking primary source per event
ALTER TABLE event_sources
  ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;

-- 2) Add recomputed_at to brand_scores for freshness tracking
ALTER TABLE brand_scores
  ADD COLUMN IF NOT EXISTS recomputed_at timestamptz;

-- 3) Create index on is_primary for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_sources_primary 
  ON event_sources(event_id, is_primary) WHERE is_primary = true;

-- 4) Update brand_evidence_view to include full provenance
DROP VIEW IF EXISTS brand_evidence_view CASCADE;

CREATE OR REPLACE VIEW brand_evidence_view AS
SELECT
  be.event_id,
  be.brand_id,
  be.event_date AS occurred_at,
  COALESCE(be.title, 'Untitled event') AS title,
  be.category AS score_component,
  be.severity,
  be.verification::text,
  be.orientation::text AS sentiment,
  es.id AS evidence_id,
  es.source_name,
  es.source_url,
  es.canonical_url,
  es.archive_url,
  es.article_snippet AS snippet,
  es.source_date,
  es.domain_owner,
  es.domain_kind,
  es.link_kind::text,
  be.created_at AS added_at
FROM brand_events be
LEFT JOIN LATERAL (
  SELECT id, source_name, source_url, canonical_url, archive_url, 
         article_snippet, source_date, domain_owner, domain_kind, link_kind
  FROM event_sources es
  WHERE es.event_id = be.event_id
  ORDER BY COALESCE(es.is_primary, false) DESC, es.created_at ASC
  LIMIT 1
) es ON TRUE;

GRANT SELECT ON brand_evidence_view TO anon, authenticated;