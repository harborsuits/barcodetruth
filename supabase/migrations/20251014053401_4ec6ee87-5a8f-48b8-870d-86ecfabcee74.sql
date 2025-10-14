BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Sync DB token to match Edge env token
SELECT net.http_post(
  url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/sync-internal-token',
  headers := '{"Content-Type":"application/json"}'::jsonb,
  body := '{}'::jsonb
);

-- Trigger pipeline again with DB-backed headers
SELECT net.http_post(
  url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds',
  headers := app.internal_headers(),
  body := '{}'::jsonb
);

SELECT net.http_post(
  url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/brand-match',
  headers := app.internal_headers(),
  body := '{}'::jsonb
);

SELECT net.http_post(
  url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?mode=agency-first&limit=300',
  headers := app.internal_headers()
);

SELECT net.http_post(
  url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-baselines',
  headers := app.internal_headers(),
  body := '{"mode":"batch"}'::jsonb
);

COMMIT;