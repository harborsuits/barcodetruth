-- Add logo_source column to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS logo_source TEXT;