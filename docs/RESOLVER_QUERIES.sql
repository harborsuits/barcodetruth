-- Evidence Link Resolver Monitoring Queries

-- =============================================================================
-- RESOLVER RUN STATS
-- =============================================================================

-- Last 10 runs with success rates
SELECT 
  id,
  mode,
  started_at,
  finished_at,
  processed,
  resolved,
  skipped,
  failed,
  ROUND(
    CASE 
      WHEN processed > 0 THEN (resolved::float / processed * 100)
      ELSE 0 
    END, 
    1
  ) as success_pct,
  EXTRACT(EPOCH FROM (finished_at - started_at))::int as duration_sec,
  notes
FROM evidence_resolution_runs
ORDER BY started_at DESC
LIMIT 10;

-- Success rate over last 24 hours
SELECT 
  COUNT(*) as total_runs,
  SUM(processed) as total_processed,
  SUM(resolved) as total_resolved,
  SUM(skipped) as total_skipped,
  SUM(failed) as total_failed,
  ROUND(
    CASE 
      WHEN SUM(processed) > 0 THEN (SUM(resolved)::float / SUM(processed) * 100)
      ELSE 0 
    END, 
    1
  ) as overall_success_pct
FROM evidence_resolution_runs
WHERE started_at > now() - interval '24 hours';

-- =============================================================================
-- PENDING SOURCES
-- =============================================================================

-- Count of pending sources by agency
SELECT 
  CASE 
    WHEN source_name ILIKE '%OSHA%' THEN 'OSHA'
    WHEN source_name ILIKE '%EPA%' THEN 'EPA'
    WHEN source_name ILIKE '%FEC%' THEN 'FEC'
    WHEN source_name ILIKE '%FDA%' THEN 'FDA'
    ELSE 'Outlet'
  END as source_type,
  COUNT(*) as pending_count
FROM event_sources
WHERE evidence_status = 'pending' AND is_generic = true
GROUP BY source_type
ORDER BY pending_count DESC;

-- Total pending sources
SELECT COUNT(*) as total_pending
FROM event_sources 
WHERE evidence_status = 'pending' AND is_generic = true;

-- =============================================================================
-- RESOLVED SOURCES
-- =============================================================================

-- Resolved sources summary
SELECT 
  COUNT(*) as total_resolved,
  COUNT(*) FILTER (WHERE archive_url IS NOT NULL) as with_archive,
  COUNT(*) FILTER (WHERE archive_url IS NULL) as without_archive,
  ROUND(
    COUNT(*) FILTER (WHERE archive_url IS NOT NULL)::float / COUNT(*) * 100, 
    1
  ) as archive_coverage_pct
FROM event_sources
WHERE evidence_status = 'resolved' AND canonical_url IS NOT NULL;

-- =============================================================================
-- AGENCY ID COVERAGE
-- =============================================================================

-- Check how many events have agency IDs that enable deterministic permalinks
SELECT
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE raw_data->>'activity_nr' IS NOT NULL OR raw_data->>'activityId' IS NOT NULL) AS osha_activity_id,
  COUNT(*) FILTER (WHERE raw_data->>'estab_id' IS NOT NULL OR raw_data->>'establishment_id' IS NOT NULL) AS osha_estab_id,
  COUNT(*) FILTER (WHERE raw_data->>'case_number' IS NOT NULL OR raw_data->>'enforcement_case_id' IS NOT NULL) AS epa_case_id,
  COUNT(*) FILTER (WHERE raw_data->>'registry_id' IS NOT NULL OR raw_data->>'frs_id' IS NOT NULL) AS epa_facility_id,
  COUNT(*) FILTER (WHERE raw_data->>'image_number' IS NOT NULL OR raw_data->>'file_number' IS NOT NULL) AS fec_filing_id
FROM brand_events;

-- Agency-specific ID coverage
SELECT 
  CASE 
    WHEN source_name ILIKE '%OSHA%' THEN 'OSHA'
    WHEN source_name ILIKE '%EPA%' THEN 'EPA'
    WHEN source_name ILIKE '%FEC%' THEN 'FEC'
    ELSE 'Other'
  END as agency,
  COUNT(*) as total_sources,
  COUNT(*) FILTER (WHERE canonical_url IS NOT NULL) as resolved,
  COUNT(*) FILTER (WHERE canonical_url IS NULL AND is_generic = true) as pending,
  ROUND(
    COUNT(*) FILTER (WHERE canonical_url IS NOT NULL)::float / COUNT(*) * 100, 
    1
  ) as resolution_pct
FROM event_sources
GROUP BY agency
ORDER BY total_sources DESC;

-- =============================================================================
-- HEALTH CHECKS
-- =============================================================================

-- Resolved but still marked generic (SHOULD BE ZERO)
SELECT COUNT(*) as resolved_but_generic_count
FROM event_sources
WHERE evidence_status = 'resolved' 
  AND is_generic = true;

-- Sources with canonical but no archive (backlog)
SELECT COUNT(*) as missing_archive_count
FROM event_sources
WHERE canonical_url IS NOT NULL 
  AND is_generic = false
  AND archive_url IS NULL;

-- Last resolver run age
SELECT 
  started_at,
  EXTRACT(EPOCH FROM (now() - started_at)) / 3600 as hours_ago,
  resolved,
  processed,
  CASE 
    WHEN processed > 0 THEN ROUND((resolved::float / processed * 100), 1)
    ELSE 0 
  END as success_pct
FROM evidence_resolution_runs
ORDER BY started_at DESC
LIMIT 1;

-- =============================================================================
-- TROUBLESHOOTING
-- =============================================================================

-- Find OSHA sources without activity_nr or estab_id (missing IDs)
SELECT 
  es.id,
  es.event_id,
  es.source_name,
  es.source_url,
  be.raw_data
FROM event_sources es
JOIN brand_events be ON be.event_id = es.event_id
WHERE es.evidence_status = 'pending'
  AND es.is_generic = true
  AND es.source_name ILIKE '%OSHA%'
  AND be.raw_data->>'activity_nr' IS NULL
  AND be.raw_data->>'estab_id' IS NULL
  AND be.raw_data->>'establishment_id' IS NULL
LIMIT 20;

-- Find EPA sources without case_number or registry_id
SELECT 
  es.id,
  es.event_id,
  es.source_name,
  es.source_url,
  be.raw_data
FROM event_sources es
JOIN brand_events be ON be.event_id = es.event_id
WHERE es.evidence_status = 'pending'
  AND es.is_generic = true
  AND es.source_name ILIKE '%EPA%'
  AND be.raw_data->>'case_number' IS NULL
  AND be.raw_data->>'enforcement_case_id' IS NULL
  AND be.raw_data->>'registry_id' IS NULL
  AND be.raw_data->>'frs_id' IS NULL
LIMIT 20;

-- Sample of outlet sources awaiting discovery
SELECT 
  es.id,
  es.event_id,
  es.source_name,
  es.source_url
FROM event_sources es
WHERE es.evidence_status = 'pending'
  AND es.is_generic = true
  AND es.source_name NOT ILIKE '%OSHA%'
  AND es.source_name NOT ILIKE '%EPA%'
  AND es.source_name NOT ILIKE '%FEC%'
LIMIT 20;

-- =============================================================================
-- CRON JOB STATUS
-- =============================================================================

-- Check if cron job exists
SELECT * FROM cron.job 
WHERE jobname = 'resolve-evidence-links-scheduled';

-- Recent cron run history
SELECT 
  start_time,
  end_time,
  status,
  return_message,
  EXTRACT(EPOCH FROM (end_time - start_time))::int as duration_sec
FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job 
  WHERE jobname = 'resolve-evidence-links-scheduled'
)
ORDER BY start_time DESC 
LIMIT 10;

-- =============================================================================
-- MANUAL FIXES
-- =============================================================================

-- Reset resolved-but-generic sources to pending (if bugs found)
-- UPDATE event_sources
-- SET evidence_status = 'pending', canonical_url = NULL, is_generic = true
-- WHERE evidence_status = 'resolved' AND is_generic = true;

-- Mark sources as 'no_evidence' to stop retry attempts
-- UPDATE event_sources
-- SET evidence_status = 'no_evidence'
-- WHERE id = '<source_id>';
