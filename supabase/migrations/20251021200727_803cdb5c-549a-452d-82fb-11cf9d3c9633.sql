-- Purge Post-related data for a clean test
BEGIN;

-- Delete ownership links for brands named 'post'
DELETE FROM public.company_ownership
WHERE child_brand_id IN (
  SELECT id FROM public.brands WHERE name ILIKE 'post'
);

-- Delete user scans for brands named 'post'
DELETE FROM public.user_scans
WHERE brand_id IN (
  SELECT id FROM public.brands WHERE name ILIKE 'post'
);

-- Delete products linked to brands named 'post'
DELETE FROM public.products
WHERE brand_id IN (
  SELECT id FROM public.brands WHERE name ILIKE 'post'
);

-- Delete the brand itself
DELETE FROM public.brands
WHERE name ILIKE 'post';

-- Delete any companies with names containing 'post'
DELETE FROM public.companies
WHERE name ILIKE '%post%';

COMMIT;