-- Enrichment Pipeline Validation Queries
-- Run these after deployment to verify data integrity

-- 1) Relationship enum enforcement (should be 0)
SELECT 
  'Invalid relationship types' as check_name,
  count(*) as issue_count
FROM company_ownership
WHERE relationship_type NOT IN ('parent','subsidiary','parent_organization');

-- 2) Accidental asset-manager parents (should be 0 after trigger)
SELECT 
  'Asset managers as parents' as check_name,
  count(*) as issue_count
FROM company_ownership co
JOIN companies c ON c.id = co.parent_company_id
JOIN asset_managers am ON c.name ILIKE '%'||am.name||'%';

-- 3) People uniqueness violation (should be 0)
SELECT 
  'Duplicate people roles' as check_name,
  count(*) as issue_count
FROM (
  SELECT company_id, role, count(*) as cnt
  FROM company_people
  GROUP BY company_id, role
  HAVING count(*) > 1
) dupes;

-- 4) Shareholder data quality (% within valid range)
SELECT 
  'Invalid shareholder percentages' as check_name,
  count(*) as issue_count
FROM company_shareholders
WHERE percent_owned < 0 OR percent_owned > 100;

-- 5) Enrichment runs visibility (last 24h)
SELECT 
  task,
  status,
  count(*) as run_count,
  round(avg(duration_ms)::numeric, 0) as avg_duration_ms,
  sum(rows_written) as total_rows
FROM enrichment_runs
WHERE finished_at > now() - interval '24 hours'
GROUP BY task, status
ORDER BY task, status;

-- 6) Coverage by feature (top 20 brands)
WITH top_brands AS (
  SELECT id, name 
  FROM brands 
  WHERE is_active = true 
  ORDER BY name 
  LIMIT 20
)
SELECT 
  b.name,
  CASE WHEN b.description IS NOT NULL THEN '✓' ELSE '✗' END as has_desc,
  CASE WHEN co.id IS NOT NULL THEN '✓' ELSE '✗' END as has_parent,
  count(DISTINCT cp.id)::text || ' people' as people_count,
  count(DISTINCT cs.id)::text || ' holders' as holder_count,
  CASE WHEN b.logo_url IS NOT NULL THEN '✓' ELSE '✗' END as has_logo
FROM top_brands b
LEFT JOIN company_ownership co ON co.child_brand_id = b.id
LEFT JOIN company_people cp ON cp.company_id = co.parent_company_id
LEFT JOIN company_shareholders cs ON cs.company_id = co.parent_company_id
GROUP BY b.id, b.name, b.description, co.id, b.logo_url
ORDER BY b.name;

-- 7) Wikipedia URL quality (should all be enwiki)
SELECT 
  'Non-English Wikipedia URLs' as check_name,
  count(*) as issue_count
FROM company_people
WHERE wikipedia_url IS NOT NULL 
  AND wikipedia_url NOT LIKE 'https://en.wikipedia.org/wiki/%';

-- 8) Image URLs using correct format
SELECT 
  'Invalid image URLs' as check_name,
  count(*) as issue_count
FROM company_people
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'https://commons.wikimedia.org/wiki/Special:FilePath/%';

-- 9) Recent enrichment success rate
SELECT 
  round(
    (count(*) FILTER (WHERE status = 'success')::numeric / 
     nullif(count(*), 0)) * 100, 
    1
  ) as success_rate_percent
FROM enrichment_runs
WHERE finished_at > now() - interval '24 hours';

-- 10) Gap analysis (brands missing key data)
SELECT 
  count(*) FILTER (WHERE description IS NULL) as missing_description,
  count(*) FILTER (WHERE logo_url IS NULL) as missing_logo,
  count(*) FILTER (WHERE wikidata_qid IS NULL) as missing_qid,
  count(*) as total_active_brands
FROM brands
WHERE is_active = true;
