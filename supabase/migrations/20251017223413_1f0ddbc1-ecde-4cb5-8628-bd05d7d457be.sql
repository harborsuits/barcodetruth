-- CRITICAL FIX: Reset all pending queue items to process NOW
UPDATE processing_queue
SET scheduled_for = now()
WHERE status = 'pending';

-- Add the missing Wikipedia enrichment cron job
SELECT cron.schedule(
  'enrich-wiki-missing',
  '*/30 * * * *',  -- Every 30 minutes
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/enrich-brand-wiki?limit=10',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI0ODI0MCwiZXhwIjoyMDc0ODI0MjQwfQ.RUZgE9iCxSMTTHOFvXQb_7YCQIhCQD_0_7Oav7DZGjs',
      'Content-Type', 'application/json'
    )
  );
  $$
);