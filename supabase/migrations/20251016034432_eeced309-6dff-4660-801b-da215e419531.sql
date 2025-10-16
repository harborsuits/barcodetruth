-- Fix cron jobs to call bulk ingestion wrappers
-- Unschedule broken jobs
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname IN (
  'ingest-fda-hourly',
  'ingest-epa-hourly',
  'ingest-osha-hourly',
  'ingest-fec-daily'
);

-- FDA bulk ingestion (hourly at :05)
SELECT cron.schedule(
  'bulk-ingest-fda-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/bulk-ingest-fda',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- EPA bulk ingestion (hourly at :15)
SELECT cron.schedule(
  'bulk-ingest-epa-hourly',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/bulk-ingest-epa',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- OSHA bulk ingestion (hourly at :25)
SELECT cron.schedule(
  'bulk-ingest-osha-hourly',
  '25 * * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/bulk-ingest-osha',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- FEC bulk ingestion (daily at 3 AM)
SELECT cron.schedule(
  'bulk-ingest-fec-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/bulk-ingest-fec',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);