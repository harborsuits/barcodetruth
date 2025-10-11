-- Add credibility tier to event_sources
ALTER TABLE public.event_sources 
ADD COLUMN IF NOT EXISTS credibility_tier text CHECK (credibility_tier IN ('official', 'reputable', 'local', 'unknown'));

-- Add article snippet
ALTER TABLE public.event_sources
ADD COLUMN IF NOT EXISTS article_snippet text;

-- Add AI summary
ALTER TABLE public.event_sources
ADD COLUMN IF NOT EXISTS ai_summary text;

-- Add index for credibility filtering
CREATE INDEX IF NOT EXISTS idx_event_sources_credibility ON public.event_sources(credibility_tier);

-- Function to assign credibility tier based on domain
CREATE OR REPLACE FUNCTION public.assign_credibility_tier(domain text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Official government/legal sources
  IF domain ~* '(osha\.gov|epa\.gov|sec\.gov|fda\.gov|ftc\.gov|dol\.gov|usa\.gov)$' THEN
    RETURN 'official';
  END IF;
  
  -- Reputable mainstream media
  IF domain ~* '(reuters\.com|apnews\.com|bloomberg\.com|nytimes\.com|wsj\.com|washingtonpost\.com|theguardian\.com|bbc\.(com|co\.uk)|npr\.org|pbs\.org|axios\.com|politico\.com)$' THEN
    RETURN 'reputable';
  END IF;
  
  -- Local news and trade press (most others)
  IF domain ~* '\.(com|org|net|edu|gov)$' THEN
    RETURN 'local';
  END IF;
  
  -- Unknown/unverified
  RETURN 'unknown';
END;
$$;

-- Update existing records with credibility tier
UPDATE public.event_sources
SET credibility_tier = public.assign_credibility_tier(registrable_domain)
WHERE credibility_tier IS NULL AND registrable_domain IS NOT NULL;