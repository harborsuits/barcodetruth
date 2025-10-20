-- Fix batch-process-brands-v2 cron job with proper service role key

-- Drop the broken job
SELECT cron.unschedule('batch-process-brands-v2');

-- Recreate with hardcoded service role key (like other working cron jobs)
SELECT cron.schedule(
  'batch-process-brands-v2',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-process-brands',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI0ODI0MCwiZXhwIjoyMDc0ODI0MjQwfQ.jmDsrfXLrLpQZAW6bQfh8pQWLvBGvHJgTMH9fMGlLmQ',
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
