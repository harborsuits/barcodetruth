-- Two-axis politics: intensity (how active) + alignment (progressive↔traditional)

-- A) User preferences: add two explicit sliders (0–100)
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS value_political_intensity smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS value_political_alignment smallint NOT NULL DEFAULT 50;

-- Range guards
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_prefs_political_intensity_ck
  CHECK (value_political_intensity BETWEEN 0 AND 100);

ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_prefs_political_alignment_ck
  CHECK (value_political_alignment BETWEEN 0 AND 100);

-- B) Brand scores: store intensity + alignment (0–100 each)
ALTER TABLE public.brand_scores
  ADD COLUMN IF NOT EXISTS politics_intensity smallint,
  ADD COLUMN IF NOT EXISTS politics_alignment smallint;

-- Range guards
ALTER TABLE public.brand_scores
  ADD CONSTRAINT brand_scores_politics_intensity_ck
  CHECK (politics_intensity IS NULL OR politics_intensity BETWEEN 0 AND 100);

ALTER TABLE public.brand_scores
  ADD CONSTRAINT brand_scores_politics_alignment_ck
  CHECK (politics_alignment IS NULL OR politics_alignment BETWEEN 0 AND 100);

COMMENT ON COLUMN public.user_preferences.value_political_intensity IS 'User preference: 0=avoid political brands, 100=prefer very active brands';
COMMENT ON COLUMN public.user_preferences.value_political_alignment IS 'User preference: 0=progressive, 50=neutral, 100=traditional';
COMMENT ON COLUMN public.brand_scores.politics_intensity IS 'Brand political activity level: 0=inactive, 100=very active';
COMMENT ON COLUMN public.brand_scores.politics_alignment IS 'Brand political lean: 0=progressive, 50=neutral, 100=traditional';