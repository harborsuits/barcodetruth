-- Fix security: Add RLS policy for brand_evidence_view
-- The view inherits from brand_events and event_sources which already have public read policies
-- Drop and recreate without SECURITY DEFINER
DROP VIEW IF EXISTS brand_evidence_view;

CREATE VIEW brand_evidence_view 
WITH (security_invoker = true)
AS
SELECT
  be.event_id as evidence_id,
  be.brand_id,
  be.category,
  be.category::text as score_component,
  be.description as snippet,
  be.verification::text as verification,
  be.event_id,
  es.source_name,
  es.source_url,
  es.archive_url,
  es.source_date
FROM brand_events be
LEFT JOIN event_sources es ON es.event_id = be.event_id
WHERE be.event_date >= NOW() - INTERVAL '90 days'
ORDER BY be.event_date DESC, es.source_date DESC;