-- Add missing columns to products table for smart-product-lookup
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS data_source text,
ADD COLUMN IF NOT EXISTS confidence_score integer,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create index for data_source filtering
CREATE INDEX IF NOT EXISTS idx_products_data_source ON public.products(data_source);