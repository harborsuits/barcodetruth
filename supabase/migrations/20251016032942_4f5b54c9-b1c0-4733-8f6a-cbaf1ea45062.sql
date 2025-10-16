-- Enable cron extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Clear any existing jobs
select cron.unschedule(jobid) from cron.job 
where jobname in (
  'ingest-fda-hourly',
  'ingest-epa-hourly', 
  'ingest-osha-hourly',
  'ingest-fec-daily',
  'score-brands-hourly',
  'refresh-coverage-hourly'
);

-- FDA recalls (hourly at :05)
select cron.schedule(
  'ingest-fda-hourly',
  '5 * * * *',
  $$
  select net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/check-fda-recalls',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- EPA violations (hourly at :15)
select cron.schedule(
  'ingest-epa-hourly',
  '15 * * * *',
  $$
  select net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-epa-events',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- OSHA violations (hourly at :25)  
select cron.schedule(
  'ingest-osha-hourly',
  '25 * * * *',
  $$
  select net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-osha-events',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- FEC political donations (daily at 3 AM)
select cron.schedule(
  'ingest-fec-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-fec-events',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Calculate brand scores (hourly at :45)
select cron.schedule(
  'score-brands-hourly',
  '45 * * * *',
  $$
  select net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-brand-score',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Refresh coverage cache (hourly at :50)
select cron.schedule(
  'refresh-coverage-hourly',
  '50 * * * *',
  $$
  select net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/refresh-coverage-cache',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);