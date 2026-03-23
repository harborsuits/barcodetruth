
-- Raise confidence threshold from 0.4 to 0.5 in DB helper function
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
    AND COALESCE(p_category_confidence, 0) >= 0.5
    AND (
      COALESCE((p_category_impacts->>'labor')::numeric, 0) != 0
      OR COALESCE((p_category_impacts->>'environment')::numeric, 0) != 0
      OR COALESCE((p_category_impacts->>'politics')::numeric, 0) != 0
      OR COALESCE((p_category_impacts->>'social')::numeric, 0) != 0
    )
  );
$$;

-- Re-backfill score_eligible with updated threshold
UPDATE public.brand_events SET 
  score_eligible = public.compute_score_eligibility(
    category::text, is_irrelevant, source_tier, category_confidence, category_impacts
  );
