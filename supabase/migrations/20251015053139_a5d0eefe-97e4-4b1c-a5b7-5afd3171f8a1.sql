-- Add summary and logo columns to brands table
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS description_source text,
  ADD COLUMN IF NOT EXISTS description_lang text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS logo_attribution text;

COMMENT ON COLUMN public.brands.description IS 'Company summary/description from Wikipedia or manual entry';
COMMENT ON COLUMN public.brands.description_source IS 'Source of description: wikipedia, manual, etc.';
COMMENT ON COLUMN public.brands.logo_url IS 'URL to brand logo (Wikimedia Commons, Clearbit, or Storage)';
COMMENT ON COLUMN public.brands.logo_attribution IS 'Source attribution for logo';