-- Add ai_summary columns to brand_events
ALTER TABLE public.brand_events 
ADD COLUMN IF NOT EXISTS ai_summary text,
ADD COLUMN IF NOT EXISTS ai_model_version text;

-- Create index for finding events needing summaries
CREATE INDEX IF NOT EXISTS idx_brand_events_ai_summary 
ON brand_events(brand_id, ai_summary) 
WHERE ai_summary IS NULL;

-- Update cron to include enrichment jobs
SELECT cron.schedule(
  'enrich-brands-wiki',
  '35 * * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/bulk-enrich-brands',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI0ODI0MCwiZXhwIjoyMDc0ODI0MjQwfQ.n_L7fT2gxOFUr5wXqTJYlh8FphKBHT3bRQUpykz_YJE"}'::jsonb
  ) as request_id;
  $$
);

SELECT cron.schedule(
  'generate-event-summaries',
  '55 * * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/generate-event-summaries',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI0ODI0MCwiZXhwIjoyMDc0ODI0MjQwfQ.n_L7fT2gxOFUr5wXqTJYlh8FphKBHT3bRQUpykz_YJE"}'::jsonb
  ) as request_id;
  $$
);