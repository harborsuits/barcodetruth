
-- Clear any existing cron jobs for these tasks
SELECT cron.unschedule('refresh-coverage-materialized-view') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-coverage-materialized-view');

SELECT cron.unschedule('calculate-brand-scores')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'calculate-brand-scores');

-- Schedule materialized view refresh (every 6 hours)
SELECT cron.schedule(
  'refresh-coverage-materialized-view',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/refresh-materialized-views',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb
  );
  $$
);

-- Schedule scoring (every 4 hours, offset by 30 minutes after refresh)
SELECT cron.schedule(
  'calculate-brand-scores',
  '30 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/bulk-calculate-scores',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb
  );
  $$
);
