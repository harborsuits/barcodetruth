
-- Simpler approach: generate products with sequential UPCs
DO $$
DECLARE
  brand_rec RECORD;
  category_list TEXT[] := ARRAY['beverages', 'snacks', 'food', 'household', 'personal care', 'health'];
  size_list TEXT[] := ARRAY['6oz', '8oz', '10oz', '12oz', '16oz', '20oz', '24oz', '32oz', '1L', '2L'];
  variant_list TEXT[] := ARRAY['Original', 'Classic', 'Diet', 'Zero', 'Light', 'Plus', 'Ultra', 'Extra', 'Premium', 'Deluxe'];
  product_counter INT := 100000;  -- Start from 100000 for valid UPCs
  upc TEXT;
  product_name TEXT;
BEGIN
  -- For each brand (limit 60 brands = 1200 products)
  FOR brand_rec IN 
    SELECT id, name FROM brands 
    ORDER BY name
    LIMIT 60
  LOOP
    -- Create 20 variations per brand
    FOR i IN 1..20 LOOP
      -- Generate sequential UPC (12 digits)
      upc := LPAD(product_counter::TEXT, 12, '0');
      
      -- Create product name with variation
      product_name := brand_rec.name || ' ' || 
                     variant_list[((i - 1) % array_length(variant_list, 1)) + 1] || ' ' ||
                     size_list[((i - 1) % array_length(size_list, 1)) + 1];
      
      -- Insert product
      INSERT INTO products (barcode, name, brand_id, category)
      VALUES (
        upc, 
        product_name, 
        brand_rec.id, 
        category_list[((i - 1) % array_length(category_list, 1)) + 1]
      )
      ON CONFLICT (barcode) DO NOTHING;
      
      product_counter := product_counter + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Generated products from UPC 000000100000 to %', LPAD((product_counter - 1)::TEXT, 12, '0');
END $$;

-- Verify results
SELECT 
  COUNT(*) as total_products,
  COUNT(DISTINCT brand_id) as distinct_brands,
  MIN(barcode) as min_upc,
  MAX(barcode) as max_upc
FROM products
WHERE barcode >= '000000100000';
