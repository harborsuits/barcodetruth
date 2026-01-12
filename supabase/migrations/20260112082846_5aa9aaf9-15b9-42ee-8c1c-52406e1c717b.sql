-- Add company_type enum and column to brands table
CREATE TYPE public.company_type_enum AS ENUM ('public', 'private', 'subsidiary', 'independent', 'unknown');

ALTER TABLE public.brands 
ADD COLUMN company_type public.company_type_enum DEFAULT 'unknown';

-- Set Adidas to public immediately
UPDATE public.brands 
SET company_type = 'public' 
WHERE LOWER(name) = 'adidas' OR wikidata_qid = 'Q3895';

-- Set other known public companies
UPDATE public.brands 
SET company_type = 'public' 
WHERE LOWER(name) IN ('nike', 'coca-cola', 'pepsi', 'nestle', 'unilever', 'apple', 'microsoft', 'amazon', 'google', 'meta', 'disney', 'walmart', 'target', 'costco', 'mcdonald''s', 'starbucks', 'puma', 'new balance', 'under armour');

-- Create index for performance
CREATE INDEX idx_brands_company_type ON public.brands(company_type);