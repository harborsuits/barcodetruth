-- Add missing cache_expires_at column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS cache_expires_at TIMESTAMP WITH TIME ZONE;

-- Add index for cache expiration queries
CREATE INDEX IF NOT EXISTS idx_products_cache_expires_at 
ON public.products(cache_expires_at) 
WHERE cache_expires_at IS NOT NULL;