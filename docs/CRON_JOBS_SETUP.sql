-- Cron jobs for automated data ingestion and scoring
-- Run these SQL statements in your Supabase SQL editor to schedule automated tasks
-- Replace <PROJECT_REF> and <INTERNAL_FN_TOKEN> with your actual values

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Pull feeds from official sources (OSHA, EPA, FDA, FEC) every 15 minutes
-- This fetches new events from government databases and news APIs
SELECT cron.schedule(
  'pull-feeds-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/pull-feeds',
    headers := jsonb_build_object('x-internal-token','<INTERNAL_FN_TOKEN>','Content-Type','application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- 2. Resolve evidence links (convert homepages to article permalinks) every 15 minutes
-- This improves evidence quality by finding the actual article URLs from homepage references
SELECT cron.schedule(
  'resolve-evidence-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/resolve-evidence-links?mode=agency-first&limit=300',
    headers := jsonb_build_object('x-internal-token','<INTERNAL_FN_TOKEN>','Content-Type','application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- 3. Calculate brand baseline scores nightly at 2:10 AM
-- This updates all brand scores based on accumulated events
SELECT cron.schedule(
  'calculate-baselines-nightly',
  '10 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-baselines',
    headers := jsonb_build_object('x-internal-token','<INTERNAL_FN_TOKEN>','Content-Type','application/json'),
    body := jsonb_build_object('mode','batch'),
    timeout_milliseconds := 60000
  );
  $$
);

-- 4. (Optional) Generate AI summaries for new evidence every hour
-- Uncomment if you want automated evidence summarization
-- SELECT cron.schedule(
--   'generate-summaries-hourly',
--   '0 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/backfill-evidence-summaries',
--     headers := jsonb_build_object('Content-Type','application/json'),
--     body := jsonb_build_object('limit', 100, 'dryRun', false),
--     timeout_milliseconds := 90000
--   );
--   $$
-- );

-- View all scheduled jobs
SELECT * FROM cron.job;

-- View job run history
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;

-- Unschedule jobs (if needed)
-- SELECT cron.unschedule('pull-feeds-15m');
-- SELECT cron.unschedule('resolve-evidence-15m');
-- SELECT cron.unschedule('calculate-baselines-nightly');

-- Manual trigger examples (for testing)
-- Pull feeds now:
-- SELECT net.http_post(
--   url := 'https://<PROJECT_REF>.supabase.co/functions/v1/pull-feeds',
--   headers := jsonb_build_object('x-internal-token','<INTERNAL_FN_TOKEN>','Content-Type','application/json'),
--   body := '{}'::jsonb
-- );

-- Resolve evidence now:
-- SELECT net.http_post(
--   url := 'https://<PROJECT_REF>.supabase.co/functions/v1/resolve-evidence-links?mode=agency-first&limit=300',
--   headers := jsonb_build_object('x-internal-token','<INTERNAL_FN_TOKEN>','Content-Type','application/json'),
--   body := '{}'::jsonb
-- );

-- Calculate baselines now:
-- SELECT net.http_post(
--   url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-baselines',
--   headers := jsonb_build_object('x-internal-token','<INTERNAL_FN_TOKEN>','Content-Type','application/json'),
--   body := jsonb_build_object('mode','batch')
-- );
