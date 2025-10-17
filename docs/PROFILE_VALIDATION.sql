-- Brand Profile Validation Queries
-- Run these to verify the profile implementation is working correctly

-- Prerequisites: Replace <brand-uuid> and <user-uuid> with actual IDs from your database
-- Get a sample brand ID:
-- SELECT id, name FROM brands LIMIT 1;

-- Get current user ID (run in authenticated context):
-- SELECT auth.uid();

-- ============================================
-- A) Ownership appears in profile
-- ============================================
-- Should return upstream/downstream ownership as JSON arrays
SELECT 
  (brand_profile_view('<brand-uuid>'))->'ownership'->'upstream' AS parents,
  (brand_profile_view('<brand-uuid>'))->'ownership'->'downstream' AS subsidiaries;

-- Example expected output:
-- parents: [{"brand_id": "...", "brand_name": "Parent Corp", "relationship": "subsidiary_of", ...}]
-- subsidiaries: [{"brand_id": "...", "brand_name": "Child Brand", ...}]

-- ============================================
-- B) Profile evidence has linked sources
-- ============================================
-- Should return canonical_url values for evidence items
SELECT jsonb_path_query(
  brand_profile_view('<brand-uuid>'), 
  '$.evidence[*].canonical_url'
) AS evidence_urls
LIMIT 5;

-- Example expected output:
-- "https://www.reuters.com/article/..."
-- "https://www.theguardian.com/..."

-- ============================================
-- C) Personalized score returns even with 0 events
-- ============================================
-- Should always return a row (score=50 baseline if no events)
SELECT 
  brand_id,
  personalized_score,
  components
FROM personalized_brand_score('<brand-uuid>', '<user-uuid>');

-- Example expected output (brand with no events):
-- brand_id | personalized_score | components
-- ---------|-------------------|------------
-- abc-123  | 50                | {"raw_weighted": 0, ...}

-- ============================================
-- D) Wikipedia descriptions exist
-- ============================================
-- Check brands with Wikipedia summaries
SELECT 
  id,
  name,
  LEFT(description, 100) AS description_preview,
  description_source
FROM brands
WHERE description IS NOT NULL
  AND description_source = 'wikipedia'
LIMIT 5;

-- ============================================
-- E) User preferences table is accessible
-- ============================================
-- Verify user can read/write their preferences
SELECT * FROM user_preferences WHERE user_id = '<user-uuid>';

-- Insert/update test (replace with actual user_id):
-- INSERT INTO user_preferences (user_id, w_labor, w_environment)
-- VALUES ('<user-uuid>', 1.5, 1.2)
-- ON CONFLICT (user_id) 
-- DO UPDATE SET w_labor = 1.5, w_environment = 1.2;

-- ============================================
-- F) Ownership indexes exist
-- ============================================
-- Verify performance indexes are in place
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename = 'brand_ownerships'
  AND indexname IN ('brand_ownerships_brand_idx', 'brand_ownerships_parent_idx');

-- Expected: 2 rows returned

-- ============================================
-- G) RLS policies allow reads
-- ============================================
-- Check that read policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE policyname IN ('be_read', 'es_read', 'bo_read');

-- Expected: 3 policies (brand_events, event_sources, brand_ownerships)

-- ============================================
-- H) Full profile blob returns correctly
-- ============================================
-- Complete profile with all sections
SELECT 
  jsonb_pretty(brand_profile_view('<brand-uuid>')) AS full_profile;

-- Should return JSON with:
-- - brand: {id, name, description, description_source, logo_url, ...}
-- - score: {score, updated_at, reason_json}
-- - coverage: {events_30d, events_90d, verified_rate, ...}
-- - ownership: {upstream: [...], downstream: [...]}
-- - evidence: [{event_date, title, category, source_name, canonical_url, ...}, ...]

-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- If ownership is empty but you expect data:
SELECT * FROM brand_ownerships WHERE brand_id = '<brand-uuid>' OR parent_brand_id = '<brand-uuid>';

-- If evidence is empty:
SELECT COUNT(*) FROM brand_events WHERE brand_id = '<brand-uuid>';
SELECT COUNT(*) FROM event_sources es 
JOIN brand_events be ON be.event_id = es.event_id 
WHERE be.brand_id = '<brand-uuid>';

-- If personalized score fails:
SELECT * FROM user_preferences WHERE user_id = '<user-uuid>';

-- Check cron jobs are scheduled:
SELECT * FROM cron.job WHERE jobname IN ('enrich-wiki-missing', 'batch-processor-scheduled');
