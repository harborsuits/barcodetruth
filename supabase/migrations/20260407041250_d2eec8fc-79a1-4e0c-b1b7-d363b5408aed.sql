
-- Add brand_relevance_score column to brand_events
-- 3 = exact brand mention, 2 = product line, 1 = parent-only, 0 = unrelated
ALTER TABLE public.brand_events 
ADD COLUMN IF NOT EXISTS brand_relevance_score smallint DEFAULT 0;

-- Add noise_category flag for marketing/PR/sponsorship detection
ALTER TABLE public.brand_events 
ADD COLUMN IF NOT EXISTS is_marketing_noise boolean DEFAULT false;

-- Add duplicate_cluster_id to group duplicate events
ALTER TABLE public.brand_events 
ADD COLUMN IF NOT EXISTS duplicate_cluster_id uuid;

-- Index for fast filtering during recompute
CREATE INDEX IF NOT EXISTS idx_brand_events_relevance_score 
ON public.brand_events (brand_relevance_score) WHERE score_eligible = true;

CREATE INDEX IF NOT EXISTS idx_brand_events_marketing_noise 
ON public.brand_events (is_marketing_noise) WHERE is_marketing_noise = true;
