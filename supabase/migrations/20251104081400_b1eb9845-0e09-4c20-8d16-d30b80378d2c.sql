-- Prevent empty brand names
-- First, set a placeholder name for the existing empty brand
UPDATE brands 
SET name = 'Unnamed Brand' 
WHERE name = '' OR name IS NULL;

-- Add constraint to prevent empty names in the future
ALTER TABLE brands 
ALTER COLUMN name SET NOT NULL;

-- Add check constraint to ensure name is not just whitespace
ALTER TABLE brands 
ADD CONSTRAINT brands_name_not_empty 
CHECK (trim(name) != '');