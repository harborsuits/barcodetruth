-- Unschedule existing jobs
SELECT cron.unschedule('pull-feeds-15m');
SELECT cron.unschedule('brand-match-10m');
SELECT cron.unschedule('resolve-evidence-15m');
SELECT cron.unschedule('calculate-baselines-nightly');

-- Create secure cron jobs with dual-header authentication (x-internal-token + x-cron)
-- These jobs call internal functions with both security headers
SELECT cron.schedule(
  'pull-feeds-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds',
    headers := jsonb_build_object(
      'x-internal-token', current_setting('app.settings.internal_fn_token', true),
      'x-cron', '1',
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'brand-match-10m',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/brand-match',
    headers := jsonb_build_object(
      'x-internal-token', current_setting('app.settings.internal_fn_token', true),
      'x-cron', '1',
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'resolve-evidence-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?mode=agency-first&limit=300',
    headers := jsonb_build_object(
      'x-internal-token', current_setting('app.settings.internal_fn_token', true),
      'x-cron', '1',
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'calculate-baselines-nightly',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-baselines',
    headers := jsonb_build_object(
      'x-internal-token', current_setting('app.settings.internal_fn_token', true),
      'x-cron', '1',
      'content-type', 'application/json'
    ),
    body := '{"mode":"batch"}'::jsonb,
    timeout_milliseconds := 300000
  ) AS request_id;
  $$
);