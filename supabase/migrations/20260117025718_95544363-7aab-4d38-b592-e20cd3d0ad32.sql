-- Add enrichment progress tracking columns to brands table
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS enrichment_stage TEXT,
ADD COLUMN IF NOT EXISTS enrichment_stage_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS enrichment_started_at TIMESTAMPTZ;

-- Index for finding stale building brands
CREATE INDEX IF NOT EXISTS idx_brands_building_stale 
ON public.brands (updated_at) 
WHERE status = 'building';

COMMENT ON COLUMN public.brands.enrichment_stage IS 'Current enrichment stage: started, wikidata_search, identity_validation, wikipedia_fallback, writing_profile, computing_score, done, failed';
COMMENT ON COLUMN public.brands.enrichment_stage_updated_at IS 'When the stage was last updated';
COMMENT ON COLUMN public.brands.enrichment_started_at IS 'When enrichment processing began';