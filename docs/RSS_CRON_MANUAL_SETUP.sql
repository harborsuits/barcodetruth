-- RSS Cron Jobs Manual Setup
-- Replace YOUR_SERVICE_ROLE_KEY with your actual service role key before running

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to fetch Google News RSS for random brands
CREATE OR REPLACE FUNCTION public.cron_fetch_google_news_rss()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  brand_rec RECORD;
BEGIN
  FOR brand_rec IN 
    SELECT id FROM brands 
    WHERE is_active = true AND is_test = false 
    ORDER BY RANDOM() 
    LIMIT 20
  LOOP
    PERFORM net.http_post(
      url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-google-news-rss?brand_id=' || brand_rec.id::text,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    );
    PERFORM pg_sleep(2);
  END LOOP;
END;
$$;

-- Create function to fetch Reddit RSS for random brands
CREATE OR REPLACE FUNCTION public.cron_fetch_reddit_rss()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  brand_rec RECORD;
BEGIN
  FOR brand_rec IN 
    SELECT id FROM brands 
    WHERE is_active = true AND is_test = false 
    ORDER BY RANDOM() 
    LIMIT 20
  LOOP
    PERFORM net.http_post(
      url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-reddit-rss?brand_id=' || brand_rec.id::text,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    );
    PERFORM pg_sleep(2);
  END LOOP;
END;
$$;

-- Create function to fetch SEC EDGAR for brands with tickers
CREATE OR REPLACE FUNCTION public.cron_fetch_sec_edgar()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  mapping_rec RECORD;
BEGIN
  FOR mapping_rec IN 
    SELECT brand_id FROM brand_data_mappings 
    WHERE source = 'sec' AND label = 'ticker'
    LIMIT 50
  LOOP
    PERFORM net.http_post(
      url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-sec-edgar?brand_id=' || mapping_rec.brand_id::text,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    );
    PERFORM pg_sleep(2);
  END LOOP;
END;
$$;

-- Schedule Google News RSS (hourly at :05)
SELECT cron.schedule(
  'rss-google-news-hourly',
  '5 * * * *',
  'SELECT public.cron_fetch_google_news_rss();'
);

-- Schedule Reddit RSS (hourly at :25)
SELECT cron.schedule(
  'rss-reddit-hourly',
  '25 * * * *',
  'SELECT public.cron_fetch_reddit_rss();'
);

-- Schedule SEC EDGAR (daily at 8 AM UTC)
SELECT cron.schedule(
  'rss-sec-edgar-daily',
  '0 8 * * *',
  'SELECT public.cron_fetch_sec_edgar();'
);

-- View scheduled jobs
SELECT * FROM cron.job ORDER BY jobname;

-- View recent job runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Unschedule jobs (if needed)
-- SELECT cron.unschedule('rss-google-news-hourly');
-- SELECT cron.unschedule('rss-reddit-hourly');
-- SELECT cron.unschedule('rss-sec-edgar-daily');
