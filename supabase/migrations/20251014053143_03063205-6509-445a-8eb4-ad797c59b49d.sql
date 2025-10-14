-- Ensure pg_net and helper exist, then trigger pipeline once with secure headers
BEGIN;

-- Enable pg_net if missing
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create app schema + internal headers helper (reads token from table)
CREATE SCHEMA IF NOT EXISTS app;
ALTER SCHEMA app OWNER TO postgres;

CREATE OR REPLACE FUNCTION app.internal_headers()
RETURNS jsonb
SECURITY DEFINER
SET search_path = pg_catalog, public, app
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'x-internal-token', (SELECT val FROM _secrets_internal WHERE key='INTERNAL_FN_TOKEN'),
    'x-cron', '1',
    'Content-Type', 'application/json'
  );
$$;

-- Trigger: pull feeds
SELECT net.http_post(
  url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds',
  headers := app.internal_headers(),
  body := '{}'::jsonb
);

-- Trigger: brand match
SELECT net.http_post(
  url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/brand-match',
  headers := app.internal_headers(),
  body := '{}'::jsonb
);

-- Trigger: resolve evidence (agency-first)
SELECT net.http_post(
  url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?mode=agency-first&limit=300',
  headers := app.internal_headers()
);

-- Trigger: calculate baselines (batch)
SELECT net.http_post(
  url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-baselines',
  headers := app.internal_headers(),
  body := '{"mode":"batch"}'::jsonb
);

COMMIT;