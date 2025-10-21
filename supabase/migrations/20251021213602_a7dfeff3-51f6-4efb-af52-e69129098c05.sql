-- Add missing columns to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS description_lang TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS description_source TEXT;

-- Add same columns to brands table (in case they're missing)
ALTER TABLE brands
ADD COLUMN IF NOT EXISTS description_lang TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS description_source TEXT;