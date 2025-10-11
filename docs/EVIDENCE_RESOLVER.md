# Evidence Link Resolver

## Overview
The Evidence Link Resolver automatically upgrades generic discovery URLs (homepages, news hubs) to specific article permalinks. It prioritizes deterministic agency URLs (OSHA, EPA, FEC) before attempting outlet discovery.

## How It Works

### 1. Priority Order
```
archive_url → canonical_url → source_url
```

### 2. Resolution Strategy
1. **Agency Rules (Deterministic)** - Constructs official permalinks from captured IDs:
   - OSHA: `activity_nr`, `estab_id` → inspection/establishment detail pages
   - EPA: `case_number`, `registry_id` → ECHO enforcement/facility reports
   - FEC: `image_number`, `file_number` → filing detail pages

2. **Outlet Discovery (Heuristic)** - Falls back to parsing when no agency ID:
   - Checks RSS/Atom feeds for recent articles
   - Scans homepage for article-looking links
   - Validates canonical URLs and relevance

3. **Archival** - Archives resolved permalinks via Wayback Machine

## Scheduling

### Automatic (Cron)
Runs every 30 minutes via pg_cron:
```sql
-- View scheduled jobs
SELECT * FROM cron.job WHERE jobname = 'resolve-evidence-links-scheduled';

-- View recent runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'resolve-evidence-links-scheduled')
ORDER BY start_time DESC LIMIT 10;
```

### Manual Trigger
```bash
# Resolve all pending (agency-first mode, limit 60)
curl -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?mode=agency-first&limit=60"

# Agency permalinks only (skip outlet discovery)
curl -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?mode=agency-only&limit=100"

# Resolve specific event
curl -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?event_id=<UUID>"

# Resolve specific source
curl -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?source_id=<UUID>"
```

### URL Parameters
- `mode`: `agency-only` | `agency-first` (default) | `full`
- `limit`: Max sources to process (default: 50)
- `event_id`: Process only this event's sources
- `source_id`: Process only this specific source

## Monitoring

### Telemetry Table
```sql
-- Last 10 runs
SELECT * FROM evidence_resolution_runs 
ORDER BY started_at DESC LIMIT 10;

-- Success rate over last 24h
SELECT 
  COUNT(*) as total_runs,
  SUM(resolved) as total_resolved,
  SUM(processed) as total_processed,
  ROUND(AVG(CASE WHEN processed > 0 THEN resolved::float / processed ELSE 0 END) * 100, 1) as avg_success_rate
FROM evidence_resolution_runs
WHERE started_at > now() - interval '24 hours';
```

### Health Checks
The `validate-coverage-health` function includes resolver monitoring:
- Warns if no runs in 2+ hours
- Warns if success rate < 20%
- Checks for resolved-but-still-generic sources (should be 0)

### Key Metrics
```sql
-- Pending sources (awaiting resolution)
SELECT COUNT(*) FROM event_sources 
WHERE evidence_status = 'pending' AND is_generic = true;

-- Resolved sources
SELECT COUNT(*) FROM event_sources 
WHERE evidence_status = 'resolved' AND canonical_url IS NOT NULL;

-- Sources by resolution reason
SELECT 
  notes->>'reason' as reason,
  COUNT(*) 
FROM event_sources es
JOIN evidence_resolution_runs err ON err.id::text = (es.notes->>'run_id')
WHERE evidence_status = 'resolved'
GROUP BY reason;

-- Agency ID coverage
SELECT
  COUNT(*) FILTER (WHERE raw_data->>'activity_nr' IS NOT NULL) AS osha_activity,
  COUNT(*) FILTER (WHERE raw_data->>'estab_id' IS NOT NULL) AS osha_estab,
  COUNT(*) FILTER (WHERE raw_data->>'case_number' IS NOT NULL) AS epa_case,
  COUNT(*) FILTER (WHERE raw_data->>'registry_id' IS NOT NULL) AS epa_facility,
  COUNT(*) FILTER (WHERE raw_data->>'image_number' IS NOT NULL) AS fec_filing
FROM brand_events;
```

## Ensuring Agency IDs Are Captured

### Normalization Pattern
When ingesting events, normalize synonymous field names:
```typescript
const normalized = {
  ...raw,
  activity_nr: raw.activity_nr ?? raw.activityId ?? raw.activity_id,
  estab_id: raw.estab_id ?? raw.establishment_id ?? raw.establishmentId,
  case_number: raw.case_number ?? raw.enforcement_case_id,
  registry_id: raw.registry_id ?? raw.frs_id ?? raw.facility_id,
  image_number: raw.image_number ?? raw.file_number,
};
await supabase.from('brand_events').insert({ 
  ..., 
  raw_data: normalized 
});
```

### Audit Query
```sql
-- Check ID capture rates by agency
SELECT 
  CASE 
    WHEN source_name ILIKE '%OSHA%' THEN 'OSHA'
    WHEN source_name ILIKE '%EPA%' THEN 'EPA'
    WHEN source_name ILIKE '%FEC%' THEN 'FEC'
    ELSE 'Other'
  END as agency,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE canonical_url IS NOT NULL) as resolved,
  ROUND(COUNT(*) FILTER (WHERE canonical_url IS NOT NULL)::numeric / COUNT(*) * 100, 1) as pct_resolved
FROM event_sources
GROUP BY agency
ORDER BY total DESC;
```

## Troubleshooting

### Resolver Not Running
```sql
-- Check cron job exists
SELECT * FROM cron.job WHERE jobname = 'resolve-evidence-links-scheduled';

-- Check recent cron runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'resolve-evidence-links-scheduled')
ORDER BY start_time DESC LIMIT 5;

-- Manually trigger
-- (use curl command from Manual Trigger section)
```

### Low Success Rate
```sql
-- Find sources that failed agency resolution
SELECT 
  es.id,
  es.event_id,
  es.source_name,
  be.raw_data
FROM event_sources es
JOIN brand_events be ON be.event_id = es.event_id
WHERE es.evidence_status = 'pending'
  AND es.is_generic = true
  AND es.source_name ILIKE '%OSHA%' -- or EPA, FEC
LIMIT 20;

-- Check if IDs are present in raw_data
```

### Resolved But Still Generic (Should Be Zero)
```sql
-- Find the offenders
SELECT * FROM event_sources
WHERE evidence_status = 'resolved' 
  AND is_generic = true;

-- Fix: re-process with stricter generic detection
UPDATE event_sources
SET evidence_status = 'pending', canonical_url = NULL
WHERE evidence_status = 'resolved' AND is_generic = true;
```

## Rate Limiting
- 300ms delay between resolutions (~3 req/s)
- 100ms delay on skips
- Respects robots.txt (TODO: implement parser)

## Future Enhancements
- [ ] Brand/date heuristics for outlet discovery scoring
- [ ] Canonical URL requirement (skip if missing)
- [ ] Automatic retry with exponential backoff
- [ ] Admin UI for manual resolution
- [ ] Robots.txt parser
- [ ] FDA recall permalink support
