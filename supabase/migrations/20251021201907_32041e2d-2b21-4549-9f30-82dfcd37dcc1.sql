-- Clean up all Post-related data for testing
BEGIN;

DELETE FROM public.company_ownership 
WHERE child_brand_id IN (SELECT id FROM public.brands WHERE name ILIKE 'post');

DELETE FROM public.company_ownership 
WHERE child_company_id IN (SELECT id FROM public.companies WHERE name ILIKE 'post');

DELETE FROM public.user_scans 
WHERE brand_id IN (SELECT id FROM public.brands WHERE name ILIKE 'post');

DELETE FROM public.products 
WHERE brand_id IN (SELECT id FROM public.brands WHERE name ILIKE 'post');

DELETE FROM public.brands 
WHERE name ILIKE 'post';

DELETE FROM public.companies 
WHERE name ILIKE 'post';

COMMIT;