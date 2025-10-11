-- Add AI summary tracking columns to event_sources
ALTER TABLE public.event_sources 
  ADD COLUMN IF NOT EXISTS ai_model_version text,
  ADD COLUMN IF NOT EXISTS ai_summary_updated_at timestamptz;

-- Create index for daily limit check
CREATE INDEX IF NOT EXISTS idx_event_sources_ai_summary_updated 
  ON public.event_sources(ai_summary_updated_at) 
  WHERE ai_summary_updated_at IS NOT NULL;

-- Create index for backfill queries (only on columns that exist)
CREATE INDEX IF NOT EXISTS idx_event_sources_backfill 
  ON public.event_sources(is_generic, credibility_tier) 
  WHERE ai_summary IS NULL;
