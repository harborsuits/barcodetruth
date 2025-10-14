-- Remove broken cron jobs that try to use current_setting
SELECT cron.unschedule('pull-feeds-15m');
SELECT cron.unschedule('brand-match-10m');
SELECT cron.unschedule('resolve-evidence-15m');
SELECT cron.unschedule('calculate-baselines-nightly');

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS cron_runs(
  fn text PRIMARY KEY,
  last_run timestamptz NOT NULL DEFAULT now()
);

-- Grant access to service role
GRANT ALL ON cron_runs TO service_role;