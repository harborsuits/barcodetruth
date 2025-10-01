-- Add category column to products
ALTER TABLE products
ADD COLUMN category text;

-- Add index for faster alternatives queries
CREATE INDEX idx_products_category ON products(category);

-- Seed test categories for detergent products
UPDATE products
SET category = 'laundry-detergent'
WHERE barcode IN ('012345678905', '012345678906', '012345678907', '012345678908');