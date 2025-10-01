-- Add new fields to user_preferences for enhanced features
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS notification_mode text DEFAULT 'instant' CHECK (notification_mode IN ('instant', 'digest')),
ADD COLUMN IF NOT EXISTS political_alignment text CHECK (political_alignment IN ('progressive', 'moderate', 'conservative', 'neutral')),
ADD COLUMN IF NOT EXISTS value_weights jsonb DEFAULT '{"labor": 50, "environment": 50, "politics": 50, "social": 50}'::jsonb,
ADD COLUMN IF NOT EXISTS digest_time text DEFAULT '18:00' CHECK (digest_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$');

-- Add comment for documentation
COMMENT ON COLUMN public.user_preferences.notification_mode IS 'instant = immediate push (max 2/brand/day), digest = daily summary rollup';
COMMENT ON COLUMN public.user_preferences.political_alignment IS 'User political preference for contextualization of FEC data';
COMMENT ON COLUMN public.user_preferences.value_weights IS 'User value category weights (0-100 scale)';
COMMENT ON COLUMN public.user_preferences.digest_time IS 'Preferred time for daily digest in HH:MM format (UTC)';