-- Add image_url and source columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_source ON products(source);

-- Add logo_source column to brands table if not exists
ALTER TABLE brands
ADD COLUMN IF NOT EXISTS logo_source TEXT;