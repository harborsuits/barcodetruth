-- Fix scoring cron to call bulk wrapper
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname = 'score-brands-hourly';

-- Bulk score calculation (hourly at :45)
SELECT cron.schedule(
  'bulk-calculate-scores-hourly',
  '45 * * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/bulk-calculate-scores',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);