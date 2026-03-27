
-- 1. Create brand_match_policy table for common-word brand precision control
CREATE TABLE IF NOT EXISTS public.brand_match_policy (
  brand_id UUID PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  match_mode TEXT NOT NULL DEFAULT 'normal' CHECK (match_mode IN ('normal', 'strict', 'exact_only')),
  required_context TEXT[] DEFAULT '{}',
  blocked_context TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_match_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read brand_match_policy" ON public.brand_match_policy
  FOR SELECT TO anon, authenticated USING (true);

-- 2. Add feed_visible and profile_relevant columns to brand_events
ALTER TABLE public.brand_events 
  ADD COLUMN IF NOT EXISTS feed_visible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS profile_relevant BOOLEAN NOT NULL DEFAULT true;

-- 3. Create index for efficient eligibility queries
CREATE INDEX IF NOT EXISTS idx_brand_events_eligibility 
  ON public.brand_events (brand_id, feed_visible, profile_relevant, score_eligible);
