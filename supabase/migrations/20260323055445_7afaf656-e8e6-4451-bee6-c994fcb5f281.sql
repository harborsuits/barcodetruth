
-- P2: Add source_tier and P1: score_eligible to brand_events
ALTER TABLE public.brand_events 
  ADD COLUMN IF NOT EXISTS source_tier text DEFAULT 'tier_3',
  ADD COLUMN IF NOT EXISTS score_eligible boolean DEFAULT false;

-- Add constraint for valid tiers
ALTER TABLE public.brand_events 
  ADD CONSTRAINT chk_source_tier CHECK (source_tier IN ('tier_1', 'tier_2', 'tier_3'));

-- Index for scoring pipeline to quickly find score-eligible events
CREATE INDEX IF NOT EXISTS idx_brand_events_score_eligible 
  ON public.brand_events (brand_id, score_eligible) 
  WHERE score_eligible = true;

-- Backfill existing events: set source_tier based on existing credibility and source domains
-- Tier 1: credibility >= 0.9 (official/gov sources)
-- Tier 2: credibility >= 0.7 (reputable journalism)  
-- Tier 3: everything else
UPDATE public.brand_events SET 
  source_tier = CASE 
    WHEN credibility >= 0.9 THEN 'tier_1'
    WHEN credibility >= 0.7 THEN 'tier_2'
    ELSE 'tier_3'
  END;

-- Backfill score_eligible: events that meet the gate
-- Must have: valid category, nonzero impact, tier_1 or tier_2, category_confidence >= 0.4, not irrelevant
UPDATE public.brand_events SET 
  score_eligible = (
    category IS NOT NULL
    AND category::text != 'general'
    AND is_irrelevant = false
    AND source_tier IN ('tier_1', 'tier_2')
    AND COALESCE(category_confidence, 0) >= 0.4
    AND (
      COALESCE((category_impacts->>'labor')::numeric, 0) != 0
      OR COALESCE((category_impacts->>'environment')::numeric, 0) != 0
      OR COALESCE((category_impacts->>'politics')::numeric, 0) != 0
      OR COALESCE((category_impacts->>'social')::numeric, 0) != 0
    )
  );

-- Create a helper function for determining score eligibility (reusable in triggers)
CREATE OR REPLACE FUNCTION public.compute_score_eligibility(
  p_category text,
  p_is_irrelevant boolean,
  p_source_tier text,
  p_category_confidence numeric,
  p_category_impacts jsonb
) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT (
    p_category IS NOT NULL
    AND p_category != 'general'
    AND p_is_irrelevant = false
    AND p_source_tier IN ('tier_1', 'tier_2')
    AND COALESCE(p_category_confidence, 0) >= 0.4
    AND (
      COALESCE((p_category_impacts->>'labor')::numeric, 0) != 0
      OR COALESCE((p_category_impacts->>'environment')::numeric, 0) != 0
      OR COALESCE((p_category_impacts->>'politics')::numeric, 0) != 0
      OR COALESCE((p_category_impacts->>'social')::numeric, 0) != 0
    )
  );
$$;
