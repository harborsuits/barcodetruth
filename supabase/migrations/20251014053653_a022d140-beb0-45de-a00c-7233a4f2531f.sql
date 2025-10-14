
-- Trigger the sync-internal-token function to populate the database
-- This reads INTERNAL_FN_TOKEN from Edge env and writes it to _secrets_internal

SELECT net.http_post(
  url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/sync-internal-token',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb
);

-- Now trigger the pipeline using the synced token
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
