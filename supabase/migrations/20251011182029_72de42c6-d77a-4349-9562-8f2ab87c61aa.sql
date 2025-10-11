-- Fix search path for assign_credibility_tier function
DROP FUNCTION IF EXISTS public.assign_credibility_tier(text);

CREATE OR REPLACE FUNCTION public.assign_credibility_tier(domain text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
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