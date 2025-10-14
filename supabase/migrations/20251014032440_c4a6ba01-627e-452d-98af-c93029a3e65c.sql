-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule pull-feeds every 15m
SELECT cron.schedule(
  'pull-feeds-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds',
    headers := jsonb_build_object('x-internal-token', current_setting('app.settings.internal_fn_token', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- Schedule brand-match every 10m
SELECT cron.schedule(
  'brand-match-10m',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/brand-match',
    headers := jsonb_build_object('x-internal-token', current_setting('app.settings.internal_fn_token', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  ) AS request_id;
  $$
);

-- Schedule resolve-evidence every 15m
SELECT cron.schedule(
  'resolve-evidence-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?mode=agency-first&limit=300',
    headers := jsonb_build_object('x-internal-token', current_setting('app.settings.internal_fn_token', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

-- Schedule calculate-baselines nightly at 2:10 AM
SELECT cron.schedule(
  'calculate-baselines-nightly',
  '10 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-baselines',
    headers := jsonb_build_object('x-internal-token', current_setting('app.settings.internal_fn_token', true), 'Content-Type', 'application/json'),
    body := jsonb_build_object('mode', 'batch'),
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

-- Create index for fast product lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);