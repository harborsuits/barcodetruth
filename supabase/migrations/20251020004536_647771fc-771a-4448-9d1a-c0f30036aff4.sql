-- PART 1: Schedule batch-process-brands cron job (every 30 minutes)
SELECT cron.schedule(
  'batch-process-brands-v2',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-process-brands',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'mode', 'scheduled',
      'limit', 10
    ),
    timeout_milliseconds := 300000
  );
  $$
);

-- PART 2: Clean stale queue entries
DELETE FROM processing_queue 
WHERE status = 'pending' 
  AND scheduled_for < NOW() - INTERVAL '1 day';