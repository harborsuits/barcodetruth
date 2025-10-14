-- Drop the risky exec_sql function
DROP FUNCTION IF EXISTS public.exec_sql(text);

-- Create private token storage (postgres-owned, no RLS)
CREATE TABLE IF NOT EXISTS _secrets_internal (
  key text PRIMARY KEY,
  val text NOT NULL
);

-- Insert token placeholder - REPLACE '<YOUR_INTERNAL_FN_TOKEN>' WITH ACTUAL TOKEN
INSERT INTO _secrets_internal(key, val)
VALUES ('INTERNAL_FN_TOKEN', '<YOUR_INTERNAL_FN_TOKEN>')
ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val;

-- Create app schema if not exists
CREATE SCHEMA IF NOT EXISTS app;

-- Helper function to build headers for cron (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION app.internal_headers()
RETURNS jsonb
SECURITY DEFINER
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'x-internal-token', (SELECT val FROM _secrets_internal WHERE key='INTERNAL_FN_TOKEN'),
    'x-cron', '1',
    'Content-Type', 'application/json'
  );
$$;

-- Unschedule old jobs (if they exist)
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN (
  'pull-feeds-15m',
  'brand-match-15m', 
  'resolve-evidence-links-15m',
  'calculate-baselines-nightly'
);

-- Schedule pull-feeds every 15 minutes
SELECT cron.schedule(
  'pull-feeds-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds',
    headers := app.internal_headers(),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Schedule brand-match every 15 minutes
SELECT cron.schedule(
  'brand-match-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/brand-match',
    headers := app.internal_headers(),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Schedule resolve-evidence-links every 15 minutes
SELECT cron.schedule(
  'resolve-evidence-links-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links',
    headers := app.internal_headers(),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Schedule calculate-baselines nightly at 2 AM
SELECT cron.schedule(
  'calculate-baselines-nightly',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-baselines',
    headers := app.internal_headers(),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);