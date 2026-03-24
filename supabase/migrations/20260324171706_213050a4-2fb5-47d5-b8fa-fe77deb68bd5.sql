-- Add corporate hierarchy support to companies table
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS parent_company_id uuid REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS normalized_name text;

-- Index for hierarchy traversal
CREATE INDEX IF NOT EXISTS idx_companies_parent_company_id ON public.companies(parent_company_id);

-- Index for normalized name matching
CREATE INDEX IF NOT EXISTS idx_companies_normalized_name ON public.companies(normalized_name);

-- Backfill normalized_name for existing records using basic lowercasing
UPDATE public.companies 
SET normalized_name = lower(trim(
  regexp_replace(
    regexp_replace(
      regexp_replace(name, '\s+(Inc|Corp|Corporation|LLC|Ltd|Limited|PLC|AG|SA|GmbH|Holdings|Group)\.?$', '', 'gi'),
      '[^a-zA-Z0-9\s]', ' ', 'g'),
    '\s+', ' ', 'g')
))
WHERE normalized_name IS NULL;