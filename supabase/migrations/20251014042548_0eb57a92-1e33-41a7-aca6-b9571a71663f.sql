-- IMPORTANT: Set INTERNAL_FN_TOKEN as environment variable in Supabase first
-- Generate with: openssl rand -base64 32
-- Then also run: ALTER DATABASE postgres SET app.internal_fn_token TO 'your-token';

-- Remove existing jobs (ignore errors if they don't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('pull-feeds-15m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('brand-match-10m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('resolve-evidence-15m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('calculate-baselines-nightly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Schedule pull-feeds (every 15 min)
SELECT cron.schedule(
  'pull-feeds-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds',
    headers := jsonb_build_object(
      'x-internal-token', current_setting('app.internal_fn_token', true),
      'x-cron', '1',
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Schedule brand-match (every 10 min)
SELECT cron.schedule(
  'brand-match-10m',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/brand-match',
    headers := jsonb_build_object(
      'x-internal-token', current_setting('app.internal_fn_token', true),
      'x-cron', '1',
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
  $$
);

-- Schedule resolve-evidence-links (every 15 min)
SELECT cron.schedule(
  'resolve-evidence-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?mode=agency-first&limit=300',
    headers := jsonb_build_object(
      'x-internal-token', current_setting('app.internal_fn_token', true),
      'x-cron', '1',
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Schedule calculate-baselines (nightly at 2:10 AM)
SELECT cron.schedule(
  'calculate-baselines-nightly',
  '10 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-baselines',
    headers := jsonb_build_object(
      'x-internal-token', current_setting('app.internal_fn_token', true),
      'x-cron', '1',
      'content-type', 'application/json'
    ),
    body := jsonb_build_object('mode', 'batch'),
    timeout_milliseconds := 300000
  );
  $$
);