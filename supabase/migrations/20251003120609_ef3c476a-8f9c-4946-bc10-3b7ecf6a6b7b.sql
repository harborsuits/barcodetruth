-- Performance indexes for baseline calculations
CREATE INDEX IF NOT EXISTS idx_brand_events_brand_time 
  ON brand_events (brand_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_sources_event 
  ON event_sources (event_id);

CREATE INDEX IF NOT EXISTS idx_brand_scores_brand 
  ON brand_scores (brand_id);

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule nightly baseline recalculation at 3 AM UTC
-- Processes all brands in batches
SELECT cron.schedule(
  'nightly-baseline-calculation',
  '0 3 * * *', -- 3 AM UTC daily
  $$
  SELECT
    net.http_post(
        url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-baselines',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI0ODI0MCwiZXhwIjoyMDc0ODI0MjQwfQ.Sf9OZjKfKLcAHSw13s5CwRTlUKqKDc-o7yH88x3P2d8"}'::jsonb,
        body:=concat('{"mode": "batch", "timestamp": "', now()::text, '"}')::jsonb
    ) as request_id;
  $$
);