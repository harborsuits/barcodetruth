
-- Generate 300+ valid UPC-A products using existing brands
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
  -- Pick first 15 brands and create 20 products each
  FOR brand_rec IN 
    SELECT id, name FROM brands 
    ORDER BY name
    LIMIT 15
  LOOP
    FOR i IN 1..20 LOOP
      -- Generate 11-digit base
      base_upc := '04900' || LPAD(((counter * 13) % 100000)::TEXT, 6, '0');
      
      -- Calculate check digit using the function
      full_upc := upc_check_digit(base_upc);
      
      IF full_upc IS NOT NULL THEN
        product_name := brand_rec.name || ' ' || 
                       variants[((i-1) % 3) + 1] || ' ' ||
                       sizes[((i-1) % 5) + 1];
        
        BEGIN
          INSERT INTO products (barcode, name, brand_id, category, upc_type, valid_checksum)
          VALUES (
            full_upc,
            product_name,
            brand_rec.id,
            categories[((i-1) % 5) + 1],
            'upc-a',
            true
          );
          counter := counter + 1;
        EXCEPTION WHEN unique_violation THEN
          -- Skip duplicates
          NULL;
        END;
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Generated % valid UPC-A products', counter;
END $$;

-- Show results
SELECT 
  upc_type,
  valid_checksum,
  COUNT(*) as count
FROM products
GROUP BY upc_type, valid_checksum
ORDER BY upc_type DESC, valid_checksum DESC;
