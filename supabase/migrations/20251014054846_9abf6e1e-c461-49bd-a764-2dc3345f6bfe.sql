
-- TICKET A2: Add checksum fields and indexes

-- Add new columns for barcode validation
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS upc_type text CHECK (upc_type IN ('upc-a','ean-13','other')) DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS valid_checksum boolean DEFAULT false;

-- Add index on brand_id for faster joins
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);

-- Verify unique constraint exists on barcode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'products_barcode_key'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_barcode_key UNIQUE (barcode);
  END IF;
END $$;

-- Helper function to calculate UPC-A check digit
CREATE OR REPLACE FUNCTION upc_check_digit(barcode text) RETURNS text AS $$
DECLARE
  sum_odd int := 0;
  sum_even int := 0;
  i int;
  digit int;
  check_digit int;
BEGIN
  -- UPC-A is 12 digits, last is check digit
  IF length(barcode) != 11 THEN
    RETURN NULL;
  END IF;
  
  -- Sum odd positions (1,3,5,7,9,11) and multiply by 3
  FOR i IN 1..11 BY 2 LOOP
    sum_odd := sum_odd + substring(barcode, i, 1)::int;
  END LOOP;
  sum_odd := sum_odd * 3;
  
  -- Sum even positions (2,4,6,8,10)
  FOR i IN 2..10 BY 2 LOOP
    sum_even := sum_even + substring(barcode, i, 1)::int;
  END LOOP;
  
  -- Check digit = (10 - ((sum_odd + sum_even) % 10)) % 10
  check_digit := (10 - ((sum_odd + sum_even) % 10)) % 10;
  
  RETURN barcode || check_digit::text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generate 300 products with valid UPC-A codes (12 digits with check digit)
DO $$
DECLARE
  brand_rec RECORD;
  counter INT := 0;
  base_upc TEXT;
  full_upc TEXT;
  product_name TEXT;
  categories TEXT[] := ARRAY['beverages', 'snacks', 'food', 'household', 'personal care'];
  sizes TEXT[] := ARRAY['6oz', '12oz', '20oz', '1L', '2L'];
  variants TEXT[] := ARRAY['Original', 'Classic', 'Premium'];
BEGIN
  -- Pick 15 major brands and create 20 products each = 300 products
  FOR brand_rec IN 
    SELECT id, name FROM brands 
    WHERE parent_company IN (
      'The Coca-Cola Company', 'PepsiCo', 'Nestlé S.A.', 
      'Procter & Gamble', 'Unilever'
    )
    ORDER BY name
    LIMIT 15
  LOOP
    FOR i IN 1..20 LOOP
      -- Generate 11-digit base (company prefix + item number)
      base_upc := '04900' || LPAD((counter % 100000)::TEXT, 6, '0');
      
      -- Calculate check digit
      full_upc := upc_check_digit(base_upc);
      
      IF full_upc IS NOT NULL THEN
        product_name := brand_rec.name || ' ' || 
                       variants[((i-1) % 3) + 1] || ' ' ||
                       sizes[((i-1) % 5) + 1];
        
        -- Insert with valid UPC-A
        INSERT INTO products (barcode, name, brand_id, category, upc_type, valid_checksum)
        VALUES (
          full_upc,
          product_name,
          brand_rec.id,
          categories[((i-1) % 5) + 1],
          'upc-a',
          true
        )
        ON CONFLICT (barcode) DO NOTHING;
        
        counter := counter + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Generated % products with valid UPC-A codes', counter;
END $$;

-- Verification query
SELECT 
  upc_type, 
  valid_checksum, 
  COUNT(*) as count
FROM products 
GROUP BY upc_type, valid_checksum 
ORDER BY upc_type, valid_checksum;
