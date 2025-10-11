-- Schedule resolver to run every 30 minutes using pg_cron
-- First, enable pg_net extension if not already enabled (for http_post)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the resolver job (runs every 30 minutes)
SELECT cron.schedule(
  'resolve-evidence-links-scheduled',
  '*/30 * * * *', -- every 30 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      params := jsonb_build_object('mode', 'agency-first', 'limit', '60')
    ) as request_id;
  $$
);

-- Store service role key in settings for cron job access
-- NOTE: This should be set via ALTER DATABASE in production
-- For now, the cron job will use the SERVICE_ROLE_KEY from env