-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Pull feeds from official sources every 15 minutes
SELECT cron.schedule(
  'pull-feeds-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds',
    headers := jsonb_build_object('x-internal-token',(SELECT value FROM vault.decrypted_secrets WHERE name = 'INTERNAL_FN_TOKEN'),'Content-Type','application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- 2. Resolve evidence links every 15 minutes
SELECT cron.schedule(
  'resolve-evidence-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?mode=agency-first&limit=300',
    headers := jsonb_build_object('x-internal-token',(SELECT value FROM vault.decrypted_secrets WHERE name = 'INTERNAL_FN_TOKEN'),'Content-Type','application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- 3. Calculate baselines nightly at 2:10 AM
SELECT cron.schedule(
  'calculate-baselines-nightly',
  '10 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-baselines',
    headers := jsonb_build_object('x-internal-token',(SELECT value FROM vault.decrypted_secrets WHERE name = 'INTERNAL_FN_TOKEN'),'Content-Type','application/json'),
    body := jsonb_build_object('mode','batch'),
    timeout_milliseconds := 60000
  );
  $$
);