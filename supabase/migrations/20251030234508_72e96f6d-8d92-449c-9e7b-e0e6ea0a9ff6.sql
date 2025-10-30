-- Add missing column to fix PostgREST schema cache error expecting 'source'
-- Safe no-op if already present
ALTER TABLE public.staging_products
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Touch table to ensure schema cache refresh (comment)
COMMENT ON COLUMN public.staging_products.source IS 'Optional source label for seeded rows (csv|openfoodfacts)';