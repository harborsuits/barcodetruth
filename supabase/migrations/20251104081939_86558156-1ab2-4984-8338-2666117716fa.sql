-- Add slug column if it doesn't exist
ALTER TABLE brands ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS brands_slug_unique ON brands(slug) WHERE slug IS NOT NULL;

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION generate_slug(brand_name TEXT, brand_uuid UUID) 
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate base slug from name (or fallback to UUID prefix)
  IF brand_name IS NULL OR trim(brand_name) = '' THEN
    base_slug := 'brand-' || left(brand_uuid::text, 8);
  ELSE
    base_slug := lower(regexp_replace(brand_name, '[^a-z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' THEN
      base_slug := 'brand-' || left(brand_uuid::text, 8);
    END IF;
  END IF;
  
  -- Ensure uniqueness by appending counter if needed
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM brands WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Backfill slugs for existing brands
UPDATE brands
SET slug = generate_slug(name, id)
WHERE slug IS NULL;

-- Make slug NOT NULL after backfill
ALTER TABLE brands ALTER COLUMN slug SET NOT NULL;