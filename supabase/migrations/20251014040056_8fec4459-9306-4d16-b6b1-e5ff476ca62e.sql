-- Remove the cron wrapper jobs that use broken token forwarding
SELECT cron.unschedule('pull-feeds-15m');
SELECT cron.unschedule('brand-match-10m');
SELECT cron.unschedule('resolve-evidence-15m');

-- Call internal functions directly with service_role auth (like your other jobs do)
SELECT cron.schedule(
  'pull-feeds-direct',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-token', current_setting('app.settings.internal_fn_token', true)
    ),
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'brand-match-direct',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/brand-match',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-token', current_setting('app.settings.internal_fn_token', true)
    ),
    timeout_milliseconds := 45000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'resolve-evidence-direct',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?mode=agency-first&limit=300',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-token', current_setting('app.settings.internal_fn_token', true)
    ),
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

-- Set the internal token in app settings (you'll need to set this manually)
-- ALTER DATABASE postgres SET app.settings.internal_fn_token = 'your-token-here';