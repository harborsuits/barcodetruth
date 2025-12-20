-- Add dedicated timestamp for news vector staleness (not relying on updated_at)
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS news_vector_updated_at TIMESTAMPTZ;

-- Add index for finding stale brands
CREATE INDEX IF NOT EXISTS idx_brands_news_vector_updated_at 
ON public.brands(news_vector_updated_at) 
WHERE is_active = true;