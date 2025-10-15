-- Backfill primary sources for existing OSHA events
INSERT INTO event_sources (event_id, source_name, title, canonical_url, source_url, owner_domain, is_primary, link_kind, article_snippet, source_date)
SELECT
  be.event_id,
  'OSHA' AS source_name,
  COALESCE(
    be.raw_data->>'case_name',
    be.raw_data->>'violation_type',
    'OSHA Inspection #' || COALESCE(be.raw_data->>'activity_nr', be.raw_data->>'inspection_nr')
  ) AS title,
  be.source_url AS canonical_url,
  be.source_url,
  'osha.gov' AS owner_domain,
  TRUE AS is_primary,
  'database' AS link_kind,
  be.description AS article_snippet,
  be.occurred_at AS source_date
FROM brand_events be
LEFT JOIN event_sources es ON es.event_id = be.event_id AND es.is_primary = TRUE
WHERE be.verification = 'official'
  AND be.category = 'labor'
  AND be.source_url IS NOT NULL
  AND be.source_url LIKE '%osha.gov%'
  AND es.event_id IS NULL
ON CONFLICT (event_id, canonical_url) DO NOTHING;

-- Backfill primary sources for existing EPA events
INSERT INTO event_sources (event_id, source_name, title, canonical_url, source_url, owner_domain, is_primary, link_kind, article_snippet, source_date)
SELECT
  be.event_id,
  'EPA' AS source_name,
  COALESCE(be.title, be.raw_data->>'action', 'EPA enforcement action') AS title,
  COALESCE(be.raw_data->>'document_url', be.raw_data->>'url', be.source_url) AS canonical_url,
  be.source_url,
  'epa.gov' AS owner_domain,
  TRUE AS is_primary,
  'database' AS link_kind,
  be.description AS article_snippet,
  be.occurred_at AS source_date
FROM brand_events be
LEFT JOIN event_sources es ON es.event_id = be.event_id AND es.is_primary = TRUE
WHERE be.verification = 'official'
  AND be.category = 'environment'
  AND (be.source_url IS NOT NULL OR be.raw_data->>'document_url' IS NOT NULL OR be.raw_data->>'url' IS NOT NULL)
  AND (be.source_url LIKE '%epa.gov%' OR be.raw_data->>'document_url' LIKE '%epa.gov%' OR be.raw_data->>'url' LIKE '%epa.gov%')
  AND es.event_id IS NULL
ON CONFLICT (event_id, canonical_url) DO NOTHING;

-- Backfill primary sources for existing FDA events
INSERT INTO event_sources (event_id, source_name, title, canonical_url, source_url, owner_domain, is_primary, link_kind, article_snippet, source_date)
SELECT
  be.event_id,
  'FDA' AS source_name,
  COALESCE(be.title, be.raw_data->>'recall_initiation_reason', 'FDA product recall') AS title,
  COALESCE(be.raw_data->>'recall_url', be.raw_data->>'url', be.source_url) AS canonical_url,
  be.source_url,
  'fda.gov' AS owner_domain,
  TRUE AS is_primary,
  'database' AS link_kind,
  be.description AS article_snippet,
  be.occurred_at AS source_date
FROM brand_events be
LEFT JOIN event_sources es ON es.event_id = be.event_id AND es.is_primary = TRUE
WHERE be.verification = 'official'
  AND be.category = 'social'
  AND (be.source_url IS NOT NULL OR be.raw_data->>'recall_url' IS NOT NULL OR be.raw_data->>'url' IS NOT NULL)
  AND (be.source_url LIKE '%fda.gov%' OR be.raw_data->>'recall_url' LIKE '%fda.gov%' OR be.raw_data->>'url' LIKE '%fda.gov%')
  AND es.event_id IS NULL
ON CONFLICT (event_id, canonical_url) DO NOTHING;

-- Backfill primary sources for existing FEC events
INSERT INTO event_sources (event_id, source_name, title, canonical_url, source_url, owner_domain, is_primary, link_kind, article_snippet, source_date)
SELECT
  be.event_id,
  'FEC' AS source_name,
  COALESCE(be.title, 'FEC filing record') AS title,
  COALESCE(be.raw_data->>'filing_url', be.raw_data->>'url', be.source_url) AS canonical_url,
  be.source_url,
  'fec.gov' AS owner_domain,
  TRUE AS is_primary,
  'database' AS link_kind,
  be.description AS article_snippet,
  be.occurred_at AS source_date
FROM brand_events be
LEFT JOIN event_sources es ON es.event_id = be.event_id AND es.is_primary = TRUE
WHERE be.verification = 'official'
  AND be.category = 'politics'
  AND (be.source_url IS NOT NULL OR be.raw_data->>'filing_url' IS NOT NULL OR be.raw_data->>'url' IS NOT NULL)
  AND (be.source_url LIKE '%fec.gov%' OR be.raw_data->>'filing_url' LIKE '%fec.gov%' OR be.raw_data->>'url' LIKE '%fec.gov%')
  AND es.event_id IS NULL
ON CONFLICT (event_id, canonical_url) DO NOTHING;