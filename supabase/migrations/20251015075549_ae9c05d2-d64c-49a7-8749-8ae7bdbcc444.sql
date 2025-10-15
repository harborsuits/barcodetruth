-- Enable trigram similarity for fuzzy search used by search_catalog
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add fast trigram indexes for name search (safe if already exist)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON public.products USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_brands_name_trgm ON public.brands USING GIN (name gin_trgm_ops);
