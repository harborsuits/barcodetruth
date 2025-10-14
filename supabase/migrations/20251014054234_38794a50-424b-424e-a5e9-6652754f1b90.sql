
-- Generate 1000+ products efficiently using generate_series
-- This will create product variations for each brand

DO $$
DECLARE
  brand_rec RECORD;
  base_upcs TEXT[] := ARRAY[
    '04900000', '01200000', '02840000', '03700000', '05000000',
    '01600000', '04000000', '04400000', '01300000', '03800000',
    '03600000', '03500000', '03120000', '02100000', '04470000',
    '07560000', '38137000', '01250000', '00000000'
  ];
  category_list TEXT[] := ARRAY['beverages', 'snacks', 'food', 'household', 'personal care', 'health'];
  size_list TEXT[] := ARRAY['6oz', '8oz', '10oz', '12oz', '16oz', '20oz', '24oz', '32oz', '1L', '2L'];
  variant_list TEXT[] := ARRAY['Original', 'Classic', 'Diet', 'Zero', 'Light', 'Plus', 'Ultra', 'Extra', 'Premium', 'Deluxe'];
  product_counter INT := 0;
  upc_base TEXT;
  upc_full TEXT;
  product_name TEXT;
  size_var TEXT;
  variant_var TEXT;
  category_var TEXT;
BEGIN
  -- For each brand, create multiple product variations
  FOR brand_rec IN 
    SELECT id, name FROM brands 
    WHERE parent_company IN (
      'The Coca-Cola Company', 'PepsiCo', 'Nestlé S.A.', 'Unilever', 
      'Procter & Gamble', 'Johnson & Johnson', 'Kraft Heinz', 
      'General Mills Inc', 'Mars Inc', 'Mondelez International', 
      'Colgate-Palmolive', 'Kellogg Company', 'Danone S.A.'
    )
    ORDER BY name
  LOOP
    -- Create 20 variations per brand
    FOR i IN 1..20 LOOP
      -- Generate UPC (use base + brand hash + counter)
      upc_base := base_upcs[(product_counter % array_length(base_upcs, 1)) + 1];
      upc_full := upc_base || LPAD((product_counter % 10000)::TEXT, 4, '0') || LPAD(i::TEXT, 2, '0');
      
      -- Generate product attributes
      size_var := size_list[(i % array_length(size_list, 1)) + 1];
      variant_var := variant_list[(i % array_length(variant_list, 1)) + 1];
      category_var := category_list[(i % array_length(category_list, 1)) + 1];
      
      -- Create product name
      product_name := brand_rec.name || ' ' || variant_var || ' ' || size_var;
      
      -- Insert product
      INSERT INTO products (barcode, name, brand_id, category)
      VALUES (upc_full, product_name, brand_rec.id, category_var)
      ON CONFLICT (barcode) DO NOTHING;
      
      product_counter := product_counter + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Generated % product variations', product_counter;
END $$;

-- Verify the results
SELECT 
  COUNT(*) as total_products,
  COUNT(DISTINCT brand_id) as distinct_brands,
  COUNT(DISTINCT category) as categories
FROM products;
