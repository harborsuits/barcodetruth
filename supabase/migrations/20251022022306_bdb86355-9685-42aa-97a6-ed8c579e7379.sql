-- Community Outlook: user-contributed category ratings
-- Replaces company-level score display (not IDEALS system itself)

-- Ratings table: one row per user × brand × category
CREATE TABLE IF NOT EXISTS public.community_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('labor', 'environment', 'politics', 'social')),
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  evidence_event_id UUID NULL REFERENCES public.brand_events(event_id) ON DELETE SET NULL,
  evidence_url TEXT NULL,
  context_note TEXT NULL CHECK (char_length(context_note) <= 140),
  source_trust_tier SMALLINT NULL CHECK (source_trust_tier BETWEEN 0 AND 3),
  weight NUMERIC NOT NULL DEFAULT 1.0,
  ip_hash TEXT NULL,
  ua_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, user_id, category)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_cr_brand ON public.community_ratings(brand_id);
CREATE INDEX IF NOT EXISTS idx_cr_user ON public.community_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_cr_category ON public.community_ratings(category);
CREATE INDEX IF NOT EXISTS idx_cr_brand_category ON public.community_ratings(brand_id, category);

-- Materialized view for fast aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS public.brand_category_outlook AS
SELECT
  brand_id,
  category,
  COUNT(*) AS n,
  AVG(score) AS mean_score,
  STDDEV_POP(score) AS sd,
  SUM(weight) AS total_weight,
  COUNT(*) FILTER (WHERE score = 1) AS s1,
  COUNT(*) FILTER (WHERE score = 2) AS s2,
  COUNT(*) FILTER (WHERE score = 3) AS s3,
  COUNT(*) FILTER (WHERE score = 4) AS s4,
  COUNT(*) FILTER (WHERE score = 5) AS s5
FROM public.community_ratings
GROUP BY brand_id, category;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_bco_brand_category ON public.brand_category_outlook(brand_id, category);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_community_rating_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_community_ratings_updated
  BEFORE UPDATE ON public.community_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_community_rating_timestamp();

-- RLS Policies
ALTER TABLE public.community_ratings ENABLE ROW LEVEL SECURITY;

-- Users can read their own ratings
CREATE POLICY "Users can view their own ratings"
  ON public.community_ratings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own ratings
CREATE POLICY "Users can insert their own ratings"
  ON public.community_ratings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update their own ratings"
  ON public.community_ratings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view all ratings
CREATE POLICY "Admins can view all ratings"
  ON public.community_ratings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Public can read aggregated outlook view
-- (no RLS on materialized views, but we'll expose via function)

-- Helper function to refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_community_outlook()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_category_outlook;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant necessary permissions
GRANT SELECT ON public.brand_category_outlook TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_community_outlook() TO service_role;