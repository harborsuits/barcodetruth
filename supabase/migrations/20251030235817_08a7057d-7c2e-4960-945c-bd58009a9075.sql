-- Grant read access to brand_scores for authenticated users
-- This allows the prewarm query to succeed without 403 errors

-- If brand_scores is a table, enable RLS and create policy
DO $$
BEGIN
  -- Check if brand_scores is a table (not a view)
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'brand_scores'
  ) THEN
    -- Enable RLS
    ALTER TABLE public.brand_scores ENABLE ROW LEVEL SECURITY;
    
    -- Create read policy for authenticated users (drop first to be idempotent)
    DROP POLICY IF EXISTS brand_scores_read_all ON public.brand_scores;
    CREATE POLICY brand_scores_read_all
      ON public.brand_scores
      FOR SELECT
      TO authenticated, anon
      USING (true);
  END IF;
END $$;

-- If brand_scores is a view, grant select on it
GRANT SELECT ON public.brand_scores TO authenticated, anon;