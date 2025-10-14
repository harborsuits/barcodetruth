
-- Trigger the pipeline manually right now via pg_net
-- Pull feeds first
SELECT net.http_post(
  url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-pull-feeds',
  headers := '{"Content-Type": "application/json"}'::jsonb
) as pull_request_id;

-- Wait a moment, then trigger brand-match (using a scheduled job that runs once in 10 seconds)
SELECT cron.schedule(
  'onetime-brand-match-trigger',
  '10 seconds',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-brand-match',
    headers := '{"Content-Type": "application/json"}'::jsonb
  ) as match_request_id;
  $$
);

-- And resolve evidence after that (20 seconds delay)
SELECT cron.schedule(
  'onetime-resolve-trigger',
  '20 seconds',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-resolve-evidence',
    headers := '{"Content-Type": "application/json"}'::jsonb
  ) as resolve_request_id;
  $$
);
