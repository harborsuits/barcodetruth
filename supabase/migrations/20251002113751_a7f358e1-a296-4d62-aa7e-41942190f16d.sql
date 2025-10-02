-- Create brand_social_baseline table for caching GDELT data
CREATE TABLE IF NOT EXISTS public.brand_social_baseline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  median_tone NUMERIC NOT NULL,
  doc_count INTEGER NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(brand_id)
);

-- Enable RLS
ALTER TABLE public.brand_social_baseline ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Public read brand_social_baseline" 
ON public.brand_social_baseline 
FOR SELECT 
USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage brand_social_baseline" 
ON public.brand_social_baseline 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index on fetched_at for cache expiry queries
CREATE INDEX idx_brand_social_baseline_fetched ON public.brand_social_baseline(fetched_at);

-- Create index on brand_id for quick lookups
CREATE INDEX idx_brand_social_baseline_brand_id ON public.brand_social_baseline(brand_id);