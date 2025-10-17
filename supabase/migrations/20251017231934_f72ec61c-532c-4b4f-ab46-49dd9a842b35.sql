-- Brand baseline metrics for comparative scoring
CREATE TABLE IF NOT EXISTS public.brand_baselines (
  brand_id uuid PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  
  -- Historical metrics (90-day window)
  articles_per_week numeric NOT NULL DEFAULT 0,
  median_sentiment numeric NOT NULL DEFAULT 0,
  common_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Category distribution
  labor_frequency numeric NOT NULL DEFAULT 0,
  environment_frequency numeric NOT NULL DEFAULT 0,
  politics_frequency numeric NOT NULL DEFAULT 0,
  social_frequency numeric NOT NULL DEFAULT 0,
  
  -- Source diversity
  avg_sources_per_article numeric NOT NULL DEFAULT 1,
  unique_domains integer NOT NULL DEFAULT 0,
  
  -- Baseline scores (starting point)
  baseline_labor integer NOT NULL DEFAULT 50,
  baseline_environment integer NOT NULL DEFAULT 50,
  baseline_politics integer NOT NULL DEFAULT 50,
  baseline_social integer NOT NULL DEFAULT 50,
  
  -- Status tracking
  baseline_complete boolean NOT NULL DEFAULT false,
  scan_started_at timestamp with time zone,
  scan_completed_at timestamp with time zone,
  articles_analyzed integer NOT NULL DEFAULT 0,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.brand_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read baselines"
  ON public.brand_baselines FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage baselines"
  ON public.brand_baselines FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS brand_baselines_complete_idx 
  ON public.brand_baselines(baseline_complete);