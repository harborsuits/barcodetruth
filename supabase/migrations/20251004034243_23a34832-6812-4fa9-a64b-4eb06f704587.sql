-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup of fn_call_log older than 30 days
-- Runs at 3 AM UTC daily
SELECT cron.schedule(
  'cleanup-fn-call-log',
  '0 3 * * *',
  $$
  DELETE FROM public.fn_call_log 
  WHERE created_at < now() - interval '30 days';
  $$
);