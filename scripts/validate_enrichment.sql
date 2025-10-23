-- ============================================================================
-- ENRICHMENT VALIDATION SMOKE TESTS
-- Run these queries after batch enrichment to verify data integrity
-- ============================================================================

-- 1) CRITICAL: No brand with QID should be missing a company mapping
-- Expected: 0 rows
SELECT 
  b.id,
  b.name,
  b.wikidata_qid,
  'Missing brand_data_mappings entry' AS issue
FROM brands b
LEFT JOIN brand_data_mappings m
  ON m.brand_id = b.id AND m.source = 'wikidata'
WHERE b.is_active = TRUE 
  AND b.is_test = FALSE
  AND b.wikidata_qid IS NOT NULL
  AND (m.external_id IS NULL OR m.external_id = '')
ORDER BY b.name;

-- 2) CRITICAL: Ownership link should exist for enriched brands
-- Expected: Low count (only brands without parents should appear)
SELECT 
  b.id,
  b.name,
  b.wikidata_qid,
  'Missing company_ownership entry' AS issue
FROM brands b
LEFT JOIN company_ownership o ON o.child_brand_id = b.id
WHERE b.is_active = TRUE 
  AND b.is_test = FALSE
  AND b.wikidata_qid IS NOT NULL
  AND o.parent_company_id IS NULL
ORDER BY b.name;

-- 3) People/Shareholders Coverage Snapshot
-- Shows how many brands have key people and shareholders
WITH enrichment_status AS (
  SELECT 
    b.id,
    b.name,
    EXISTS(
      SELECT 1 FROM company_people cp
      JOIN company_ownership co ON co.parent_company_id = cp.company_id
      WHERE co.child_brand_id = b.id
    ) AS has_key_people,
    EXISTS(
      SELECT 1 FROM company_shareholders cs
      JOIN company_ownership co ON co.parent_company_id = cs.company_id
      WHERE co.child_brand_id = b.id
    ) AS has_shareholders
  FROM brands b
  WHERE b.is_active = TRUE 
    AND b.is_test = FALSE
    AND b.wikidata_qid IS NOT NULL
)
SELECT
  COUNT(*) AS total_brands,
  COUNT(*) FILTER (WHERE has_key_people) AS with_people,
  COUNT(*) FILTER (WHERE has_shareholders) AS with_shareholders,
  ROUND(100.0 * COUNT(*) FILTER (WHERE has_key_people) / COUNT(*), 1) AS people_percent,
  ROUND(100.0 * COUNT(*) FILTER (WHERE has_shareholders) / COUNT(*), 1) AS shareholders_percent
FROM enrichment_status;

-- 4) Recent Enrichment Runs Summary
-- Shows last 5 runs with success/failure rates
SELECT 
  id,
  mode,
  started_at,
  finished_at,
  total,
  succeeded,
  failed,
  ROUND(100.0 * succeeded / NULLIF(total, 0), 1) AS success_rate,
  (finished_at - started_at) AS duration,
  CASE 
    WHEN finished_at IS NULL THEN 'Running'
    WHEN failed > succeeded THEN 'Poor'
    WHEN succeeded = total THEN 'Perfect'
    ELSE 'Good'
  END AS quality
FROM enrichment_runs
ORDER BY started_at DESC
LIMIT 5;

-- 5) Hot Errors (Most Recent Failures)
-- Shows brands that failed enrichment and why
SELECT 
  eri.brand_name,
  eri.error,
  er.started_at,
  er.mode
FROM enrichment_run_items eri
JOIN enrichment_runs er ON er.id = eri.run_id
WHERE eri.status = 'error'
ORDER BY er.started_at DESC, eri.brand_name
LIMIT 20;

-- 6) Lock Hygiene Check
-- Should be empty outside of active runs
SELECT 
  lock_name,
  owner,
  acquired_at,
  NOW() - acquired_at AS held_for
FROM enrichment_job_locks
ORDER BY acquired_at DESC;

-- 7) Staleness Distribution
-- Shows how many brands haven't been enriched recently
WITH brand_freshness AS (
  SELECT 
    b.id,
    b.name,
    COALESCE(
      (SELECT MAX(bdm.updated_at) 
       FROM brand_data_mappings bdm 
       WHERE bdm.brand_id = b.id AND bdm.source = 'wikidata'),
      '2000-01-01'::timestamptz
    ) AS last_enriched,
    NOW() - COALESCE(
      (SELECT MAX(bdm.updated_at) 
       FROM brand_data_mappings bdm 
       WHERE bdm.brand_id = b.id AND bdm.source = 'wikidata'),
      '2000-01-01'::timestamptz
    ) AS staleness
  FROM brands b
  WHERE b.is_active = TRUE 
    AND b.is_test = FALSE
    AND b.wikidata_qid IS NOT NULL
)
SELECT
  COUNT(*) FILTER (WHERE staleness < INTERVAL '7 days') AS fresh_7d,
  COUNT(*) FILTER (WHERE staleness >= INTERVAL '7 days' AND staleness < INTERVAL '14 days') AS stale_7_14d,
  COUNT(*) FILTER (WHERE staleness >= INTERVAL '14 days' AND staleness < INTERVAL '30 days') AS stale_14_30d,
  COUNT(*) FILTER (WHERE staleness >= INTERVAL '30 days') AS very_stale_30d_plus,
  COUNT(*) AS total
FROM brand_freshness;

-- 8) Data Quality Spot Check
-- Pick 3 random enriched brands to manually verify in UI
SELECT 
  b.id AS brand_id,
  b.name AS brand_name,
  c.name AS parent_company,
  COUNT(DISTINCT cp.id) AS key_people_count,
  COUNT(DISTINCT cs.id) AS shareholders_count,
  COALESCE(bdm.updated_at, '2000-01-01'::timestamptz) AS last_enriched
FROM brands b
LEFT JOIN brand_data_mappings bdm ON bdm.brand_id = b.id AND bdm.source = 'wikidata'
LEFT JOIN company_ownership co ON co.child_brand_id = b.id
LEFT JOIN companies c ON c.id = co.parent_company_id
LEFT JOIN company_people cp ON cp.company_id = c.id
LEFT JOIN company_shareholders cs ON cs.company_id = c.id
WHERE b.is_active = TRUE 
  AND b.is_test = FALSE
  AND b.wikidata_qid IS NOT NULL
GROUP BY b.id, b.name, c.name, bdm.updated_at
ORDER BY RANDOM()
LIMIT 3;

-- 9) Idempotency Check - No Duplicate Companies
-- Should return 0 rows
SELECT 
  wikidata_qid,
  COUNT(*) AS duplicate_count,
  STRING_AGG(name, ', ') AS company_names
FROM companies
WHERE wikidata_qid IS NOT NULL
GROUP BY wikidata_qid
HAVING COUNT(*) > 1;

-- 10) Idempotency Check - No Duplicate Ownership Links
-- Should return 0 rows
SELECT 
  child_brand_id,
  b.name AS brand_name,
  COUNT(*) AS ownership_count,
  STRING_AGG(co.parent_name, ', ') AS parents
FROM company_ownership co
JOIN brands b ON b.id = co.child_brand_id
GROUP BY child_brand_id, b.name
HAVING COUNT(*) > 1;
