
-- Add scannable products using DO block to handle missing brands gracefully
DO $$
DECLARE
  coke_id uuid;
  pepsi_id uuid;
  nestle_id uuid;
  pg_id uuid;
BEGIN
  -- Get brand IDs (use first match)
  SELECT id INTO coke_id FROM brands WHERE name ILIKE '%coca%cola%' OR name = 'Coca-Cola' LIMIT 1;
  SELECT id INTO pepsi_id FROM brands WHERE name ILIKE '%pepsi%' LIMIT 1;
  SELECT id INTO nestle_id FROM brands WHERE name ILIKE '%nestle%' OR name = 'Nestle' LIMIT 1;
  SELECT id INTO pg_id FROM brands WHERE name ILIKE '%procter%' OR name ILIKE '%p&g%' LIMIT 1;

  -- Insert products if brand exists
  IF coke_id IS NOT NULL THEN
    INSERT INTO products (barcode, name, brand_id, category) VALUES
      ('049000006346', 'Coca-Cola Classic 12oz', coke_id, 'beverages'),
      ('049000028904', 'Dasani Water 16oz', coke_id, 'beverages')
    ON CONFLICT (barcode) DO NOTHING;
  END IF;

  IF pepsi_id IS NOT NULL THEN
    INSERT INTO products (barcode, name, brand_id, category) VALUES
      ('012000001291', 'Pepsi Cola 12oz', pepsi_id, 'beverages'),
      ('028400064200', 'Lays Classic Chips', pepsi_id, 'snacks'),
      ('028400006477', 'Doritos Nacho Cheese', pepsi_id, 'snacks')
    ON CONFLICT (barcode) DO NOTHING;
  END IF;

  IF nestle_id IS NOT NULL THEN
    INSERT INTO products (barcode, name, brand_id, category) VALUES
      ('028000217303', 'DiGiorno Pizza', nestle_id, 'food'),
      ('050000422685', 'Coffee-Mate Creamer', nestle_id, 'food')
    ON CONFLICT (barcode) DO NOTHING;
  END IF;

  IF pg_id IS NOT NULL THEN
    INSERT INTO products (barcode, name, brand_id, category) VALUES
      ('037000975021', 'Tide Detergent', pg_id, 'household'),
      ('037000862109', 'Pampers Diapers', pg_id, 'household')
    ON CONFLICT (barcode) DO NOTHING;
  END IF;
END $$;

-- Report results
SELECT 
  COUNT(*) as total_products,
  COUNT(CASE WHEN created_at > now() - interval '1 minute' THEN 1 END) as just_added
FROM products;
