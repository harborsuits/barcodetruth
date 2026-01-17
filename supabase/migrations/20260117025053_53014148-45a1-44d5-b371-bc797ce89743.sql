-- Add retry/backoff columns to brands table for queue draining
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS enrichment_attempts INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_enrichment_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS enrichment_error TEXT;

-- Create index for efficient queue fetching
CREATE INDEX IF NOT EXISTS idx_brands_enrichment_queue 
ON public.brands (next_enrichment_at) 
WHERE status IN ('stub', 'failed') AND enrichment_attempts < 5;

-- Comment for clarity
COMMENT ON COLUMN public.brands.enrichment_attempts IS 'Number of enrichment attempts; resets on success';
COMMENT ON COLUMN public.brands.next_enrichment_at IS 'Next scheduled enrichment time with exponential backoff';
COMMENT ON COLUMN public.brands.enrichment_error IS 'Last enrichment error message for debugging';