-- Preference-Driven Scoring System Schema Updates

-- 1. Add dealbreakers and preference_mode to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS dealbreakers jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS preference_mode text DEFAULT 'quick';

-- 2. Add scoring vectors to brands table
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS baseline_vector jsonb DEFAULT '{"labor":0,"environment":0,"politics":0,"social":0}'::jsonb,
ADD COLUMN IF NOT EXISTS news_vector_cache jsonb DEFAULT '{"labor":0,"environment":0,"politics":0,"social":0}'::jsonb,
ADD COLUMN IF NOT EXISTS confidence_overall numeric DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS confidence_notes text;

-- 3. Add scoring fields to brand_events
ALTER TABLE public.brand_events
ADD COLUMN IF NOT EXISTS category_impacts jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS credibility numeric DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS verification_factor numeric DEFAULT 0.5;

-- 4. Create index for efficient brand vector lookups
CREATE INDEX IF NOT EXISTS idx_brands_baseline_vector ON public.brands USING gin (baseline_vector);
CREATE INDEX IF NOT EXISTS idx_brands_news_vector ON public.brands USING gin (news_vector_cache);

-- 5. Create index for event scoring queries
CREATE INDEX IF NOT EXISTS idx_events_category_impacts ON public.brand_events USING gin (category_impacts);
CREATE INDEX IF NOT EXISTS idx_events_credibility ON public.brand_events (credibility) WHERE credibility IS NOT NULL;

-- 6. Add comment for documentation
COMMENT ON COLUMN public.brands.baseline_vector IS 'Slow-moving category scores from certifications, long-term risk factors. Format: {"category": -1..+1}';
COMMENT ON COLUMN public.brands.news_vector_cache IS 'Rolling 90-day event aggregation per category. Computed by nightly job.';
COMMENT ON COLUMN public.brand_events.category_impacts IS 'Event impact per category. Format: {"category": -1..+1}';
COMMENT ON COLUMN public.brand_events.verification_factor IS 'Weight factor: verified=1.0, corroborated=0.75, other_coverage=0.5, noise=0.1';