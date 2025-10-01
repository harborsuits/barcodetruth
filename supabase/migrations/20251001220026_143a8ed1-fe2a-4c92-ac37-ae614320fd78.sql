-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Pilot brands table for gradual rollout
CREATE TABLE IF NOT EXISTS public.pilot_brands (
  brand_id UUID PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE
);

-- User preferences table with muted categories
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  muted_categories TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Index for fast muted category lookups
CREATE INDEX IF NOT EXISTS user_preferences_muted_gin ON public.user_preferences USING gin(muted_categories);
CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON public.user_preferences(user_id);

-- RLS policies for user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER set_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_preferences_updated_at();

-- Staggered cron jobs for pilot brands
-- EPA: every 2h at :05
SELECT cron.schedule(
  'epa_pilot',
  '5 */2 * * *',
  $$
    SELECT net.http_post(
      url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-epa-events?brand_id=' || brand_id::text,
      headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
    )
    FROM public.pilot_brands;
  $$
);

-- OSHA: every 3h at :15
SELECT cron.schedule(
  'osha_pilot',
  '15 */3 * * *',
  $$
    SELECT net.http_post(
      url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-osha-events?brand_id=' || brand_id::text,
      headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
    )
    FROM public.pilot_brands;
  $$
);

-- FEC: every 6h at :25
SELECT cron.schedule(
  'fec_pilot',
  '25 */6 * * *',
  $$
    SELECT net.http_post(
      url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/fetch-fec-events?brand_id=' || brand_id::text,
      headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
    )
    FROM public.pilot_brands;
  $$
);