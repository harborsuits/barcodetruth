-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Remove existing jobs if they exist
DO $$ 
DECLARE
  job_id bigint;
BEGIN
  FOR job_id IN 
    SELECT jobid FROM cron.job 
    WHERE jobname IN ('batch-processor-scheduled', 'batch-processor-breaking', 'recompute-brand-scores')
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

-- Schedule batch processor: every 5 minutes for pending queue
SELECT cron.schedule(
  'batch-processor-scheduled',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-process-brands?mode=scheduled&limit=20',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI0ODI0MCwiZXhwIjoyMDc0ODI0MjQwfQ.RUZgE9iCxSMTTHOFvXQb_7YCQIhCQD_0_7Oav7DZGjs',
      'Content-Type', 'application/json'
    )
  );
  $$
);

-- Schedule batch processor: hourly for Fortune 500 breaking news  
SELECT cron.schedule(
  'batch-processor-breaking',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-process-brands?mode=breaking&limit=50',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI0ODI0MCwiZXhwIjoyMDc0ODI0MjQwfQ.RUZgE9iCxSMTTHOFvXQb_7YCQIhCQD_0_7Oav7DZGjs',
      'Content-Type', 'application/json'
    )
  );
  $$
);

-- Schedule score recomputation: every 15 minutes
SELECT cron.schedule(
  'recompute-brand-scores',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/recompute-brand-scores',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI0ODI0MCwiZXhwIjoyMDc0ODI0MjQwfQ.RUZgE9iCxSMTTHOFvXQb_7YCQIhCQD_0_7Oav7DZGjs',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('mode', 'all')
  );
  $$
);