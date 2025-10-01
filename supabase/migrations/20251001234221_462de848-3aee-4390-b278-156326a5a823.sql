-- Enable news ingestion feature flag
INSERT INTO public.app_config (key, value) 
VALUES ('ingest_news_enabled', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb;

-- Add comment
COMMENT ON TABLE public.app_config IS 'Application feature flags and configuration';
