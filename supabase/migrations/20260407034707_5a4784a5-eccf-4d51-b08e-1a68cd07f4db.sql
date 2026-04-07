
-- Fix parent_company for store brands and sub-brands missing it
UPDATE public.brands SET parent_company = 'PepsiCo' WHERE name = 'Quaker' AND parent_company IS NULL;
UPDATE public.brands SET parent_company = 'Walmart' WHERE name = 'Great Value' AND parent_company IS NULL;
UPDATE public.brands SET parent_company = 'Costco' WHERE name = 'Kirkland Signature' AND parent_company IS NULL;
UPDATE public.brands SET parent_company = 'General Mills' WHERE name = 'Häagen-Dazs' AND parent_company IS NULL;

-- Fix parent_display_name in brand_display_profiles for brands missing it
UPDATE public.brand_display_profiles SET parent_display_name = 'PepsiCo' 
WHERE brand_id IN (
  SELECT id FROM public.brands WHERE name IN ('Frito-Lay', 'Tropicana', 'Quaker') AND parent_company = 'PepsiCo'
) AND parent_display_name IS NULL;

UPDATE public.brand_display_profiles SET parent_display_name = 'Walmart'
WHERE brand_id = (SELECT id FROM public.brands WHERE name = 'Great Value')
AND parent_display_name IS NULL;

UPDATE public.brand_display_profiles SET parent_display_name = 'Costco'
WHERE brand_id = (SELECT id FROM public.brands WHERE name = 'Kirkland Signature')
AND parent_display_name IS NULL;

UPDATE public.brand_display_profiles SET parent_display_name = 'General Mills'
WHERE brand_id = (SELECT id FROM public.brands WHERE name = 'Häagen-Dazs')
AND parent_display_name IS NULL;
