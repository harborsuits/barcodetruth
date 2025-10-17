-- ============================================================================
-- AUTONOMOUS NEWS INGESTION & SCORING
-- Set up cron jobs for automatic brand monitoring
-- ============================================================================

-- Prerequisites:
-- 1. Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Get your project details:
-- SUPABASE_URL: https://midmvcwtywnexzdwbekp.supabase.co
-- SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE

-- ============================================================================
-- PHASE 1: ONE-TIME BASELINE SCAN (Run this first for all brands)
-- ============================================================================

-- This establishes "normal" metrics for each brand (90-day historical analysis)
-- Run manually first, then optionally schedule weekly for new brands

SELECT net.http_post(
  url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/historical-baseline-scanner',
  headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE"}'::jsonb
) as request_id;

-- Optional: Schedule weekly baseline scans for new brands
SELECT cron.schedule(
  'weekly-baseline-scan',
  '0 2 * * 0', -- Sundays at 2 AM
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/historical-baseline-scanner',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE"}'::jsonb
  ) as request_id;
  $$
);

-- ============================================================================
-- PHASE 2: CONTINUOUS MONITORING (Run after baselines are complete)
-- ============================================================================

-- High-Priority Brands (Fortune 500, pilot brands)
-- Every 30 minutes
SELECT cron.schedule(
  'high-priority-ingestion',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-process-brands',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE"}'::jsonb,
    body:='{"priority":"high","limit":10}'::jsonb
  ) as request_id;
  $$
);

-- Medium-Priority Brands (Large companies)
-- Every 6 hours
SELECT cron.schedule(
  'medium-priority-ingestion',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-process-brands',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE"}'::jsonb,
    body:='{"priority":"medium","limit":20}'::jsonb
  ) as request_id;
  $$
);

-- Low-Priority Brands (Small/Medium companies)
-- Once daily at 3 AM
SELECT cron.schedule(
  'low-priority-ingestion',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-process-brands',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE"}'::jsonb,
    body:='{"priority":"low","limit":50}'::jsonb
  ) as request_id;
  $$
);

-- ============================================================================
-- MONITORING & MAINTENANCE
-- ============================================================================

-- View active cron jobs
SELECT * FROM cron.job ORDER BY jobname;

-- View recent job runs (last 24 hours)
SELECT 
  j.jobname,
  jr.start_time,
  jr.end_time,
  jr.status,
  jr.return_message
FROM cron.job j
LEFT JOIN cron.job_run_details jr ON jr.jobid = j.jobid
WHERE jr.start_time > now() - interval '24 hours'
ORDER BY jr.start_time DESC;

-- Check baseline completion status
SELECT 
  b.name,
  bb.baseline_complete,
  bb.articles_analyzed,
  bb.scan_completed_at,
  bb.articles_per_week,
  bb.baseline_labor,
  bb.baseline_environment,
  bb.baseline_politics,
  bb.baseline_social
FROM brands b
LEFT JOIN brand_baselines bb ON bb.brand_id = b.id
WHERE b.is_active = true
ORDER BY bb.baseline_complete, b.name;

-- Unschedule a job (if needed)
-- SELECT cron.unschedule('job-name-here');

-- ============================================================================
-- PRIORITY MANAGEMENT
-- ============================================================================

-- Mark brands as high-priority (for 30-min monitoring)
-- Add to pilot_brands table or use monitoring_config

-- Example: Add Nike as high-priority
UPDATE brands 
SET monitoring_config = jsonb_build_object('priority', 'high')
WHERE name = 'Nike';

-- Example: Set monitoring frequency directly
UPDATE brands 
SET ingestion_frequency = 'hourly' -- Options: hourly, daily, weekly
WHERE name = 'Coca-Cola';
