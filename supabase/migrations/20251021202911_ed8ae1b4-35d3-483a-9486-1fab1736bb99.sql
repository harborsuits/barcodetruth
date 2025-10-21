-- Add unique constraints to company_ownership table for proper upsert behavior
BEGIN;

-- Add unique constraint on child_brand_id (for brand→company links)
ALTER TABLE public.company_ownership 
ADD CONSTRAINT company_ownership_child_brand_id_key 
UNIQUE (child_brand_id);

-- Add unique constraint on child_company_id (for company→company links)
ALTER TABLE public.company_ownership 
ADD CONSTRAINT company_ownership_child_company_id_key 
UNIQUE (child_company_id);

COMMIT;