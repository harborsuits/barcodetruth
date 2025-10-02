-- Create brand_evidence_view for public proof pages
CREATE OR REPLACE VIEW brand_evidence_view AS
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

-- Indexes for fast proof queries
CREATE INDEX IF NOT EXISTS be_brand_category_idx ON brand_events (brand_id, category);
CREATE INDEX IF NOT EXISTS es_event_idx ON event_sources (event_id);
CREATE INDEX IF NOT EXISTS be_brand_date_idx ON brand_events (brand_id, event_date DESC);