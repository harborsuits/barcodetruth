-- Add brand status fields for lifecycle tracking
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'stub' CHECK (status IN ('stub', 'building', 'ready', 'failed')),
ADD COLUMN IF NOT EXISTS built_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_build_error text;

-- Update existing brands with data to 'ready' status
UPDATE public.brands 
SET status = 'ready', built_at = COALESCE(updated_at, created_at)
WHERE (logo_url IS NOT NULL OR description IS NOT NULL OR wikidata_qid IS NOT NULL)
AND status IS DISTINCT FROM 'ready';

-- Create index for status lookups
CREATE INDEX IF NOT EXISTS idx_brands_status ON public.brands(status);