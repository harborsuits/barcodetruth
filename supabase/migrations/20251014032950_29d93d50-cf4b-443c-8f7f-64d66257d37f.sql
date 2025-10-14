-- Unschedule previously created jobs (if exist)
SELECT cron.unschedule('pull-feeds-15m');
SELECT cron.unschedule('brand-match-10m');
SELECT cron.unschedule('resolve-evidence-15m');
SELECT cron.unschedule('calculate-baselines-nightly');

-- Schedule public cron wrappers (no token needed)
SELECT cron.schedule(
  'pull-feeds-15m','*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-pull-feeds',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'brand-match-10m','*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-brand-match',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'resolve-evidence-15m','*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-resolve-evidence',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'calculate-baselines-nightly','10 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-calc-baselines',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('mode','batch'),
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

-- Prime once now
SELECT net.http_post(url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-pull-feeds', headers:='{"Content-Type":"application/json"}'::jsonb, body:='{}'::jsonb);
SELECT net.http_post(url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-brand-match', headers:='{"Content-Type":"application/json"}'::jsonb, body:='{}'::jsonb);
SELECT net.http_post(url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-resolve-evidence', headers:='{"Content-Type":"application/json"}'::jsonb, body:='{}'::jsonb);
SELECT net.http_post(url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-calc-baselines', headers:='{"Content-Type":"application/json"}'::jsonb, body:='{}'::jsonb);