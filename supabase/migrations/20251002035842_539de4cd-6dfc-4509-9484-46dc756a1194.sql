-- Add transparency metadata to brand_scores
ALTER TABLE public.brand_scores
ADD COLUMN IF NOT EXISTS window_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS window_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS breakdown JSONB,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Store article text for auditability
ALTER TABLE public.brand_events
ADD COLUMN IF NOT EXISTS article_text TEXT;

-- Indexes for scoring query performance
CREATE INDEX IF NOT EXISTS be_brand_date ON public.brand_events(brand_id, event_date DESC);
CREATE INDEX IF NOT EXISTS be_category ON public.brand_events(category);