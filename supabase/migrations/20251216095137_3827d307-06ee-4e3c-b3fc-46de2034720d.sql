-- Add unique constraints for tables that need "single row" guarantees
-- Skip products (already has constraint)

-- User follows: one row per (user_id, brand_id)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_follows_user_brand_unique'
  ) THEN
    ALTER TABLE public.user_follows 
    ADD CONSTRAINT user_follows_user_brand_unique UNIQUE (user_id, brand_id);
  END IF;
END $$;

-- Brand scores: one row per brand_id (current score only)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brand_scores_brand_id_unique'
  ) THEN
    ALTER TABLE public.brand_scores
    ADD CONSTRAINT brand_scores_brand_id_unique UNIQUE (brand_id);
  END IF;
END $$;