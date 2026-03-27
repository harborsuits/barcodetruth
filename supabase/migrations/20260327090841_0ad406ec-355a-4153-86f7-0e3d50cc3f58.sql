
CREATE TABLE public.subcategory_fallbacks (
  source_subcategory text NOT NULL,
  allowed_fallback_subcategory text NOT NULL,
  PRIMARY KEY (source_subcategory, allowed_fallback_subcategory)
);

ALTER TABLE public.subcategory_fallbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON public.subcategory_fallbacks
  FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.subcategory_fallbacks (source_subcategory, allowed_fallback_subcategory) VALUES
  -- Beverages
  ('soft-drinks', 'functional-soda'),
  ('soft-drinks', 'prebiotic-soda'),
  ('soft-drinks', 'sparkling-water'),
  ('functional-soda', 'soft-drinks'),
  ('functional-soda', 'prebiotic-soda'),
  ('functional-soda', 'sparkling-water'),
  ('prebiotic-soda', 'functional-soda'),
  ('prebiotic-soda', 'soft-drinks'),
  ('prebiotic-soda', 'sparkling-water'),
  ('sparkling-water', 'soft-drinks'),
  ('sparkling-water', 'functional-soda'),
  ('energy-drinks', 'sports-drinks'),
  ('sports-drinks', 'energy-drinks'),
  ('coffee-tea', 'coffee'),
  ('coffee-tea', 'tea'),
  ('coffee', 'coffee-tea'),
  ('tea', 'coffee-tea'),
  ('bottled-water', 'sparkling-water'),
  ('sparkling-water', 'bottled-water'),
  -- Household / Cleaning
  ('laundry', 'laundry-sheets'),
  ('laundry', 'detergent'),
  ('laundry-sheets', 'laundry'),
  ('detergent', 'laundry'),
  ('surface-cleaners', 'all-purpose-cleaners'),
  ('all-purpose-cleaners', 'surface-cleaners'),
  ('dish-soap', 'dishwasher-detergent'),
  ('dishwasher-detergent', 'dish-soap'),
  -- Personal Care
  ('oral-care', 'toothpaste'),
  ('oral-care', 'mouthwash'),
  ('toothpaste', 'oral-care'),
  ('toothpaste', 'mouthwash'),
  ('mouthwash', 'oral-care'),
  ('mouthwash', 'toothpaste'),
  ('shampoo', 'hair-care'),
  ('hair-care', 'shampoo'),
  ('deodorant', 'body-care'),
  ('body-care', 'deodorant'),
  ('body-care', 'skin-care'),
  ('skin-care', 'body-care'),
  -- Snacks
  ('salty-snacks', 'chips'),
  ('salty-snacks', 'crackers'),
  ('chips', 'salty-snacks'),
  ('crackers', 'salty-snacks'),
  -- Footwear / Apparel
  ('footwear', 'athletic-footwear'),
  ('athletic-footwear', 'footwear'),
  ('apparel', 'activewear'),
  ('activewear', 'apparel');
