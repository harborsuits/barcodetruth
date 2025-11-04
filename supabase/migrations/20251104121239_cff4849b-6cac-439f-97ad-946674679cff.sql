-- Fix malformed brand names and slugs
-- This migration:
-- 1. Creates a proper slug generation function
-- 2. Adds a trigger to auto-generate slugs
-- 3. Backfills existing malformed data

-- Create slug generation function
CREATE OR REPLACE FUNCTION generate_brand_slug(brand_name TEXT, brand_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  -- Normalize name: lowercase, replace special chars with hyphens, trim
  base_slug := lower(trim(regexp_replace(brand_name, '[^a-zA-Z0-9]+', '-', 'g'), '-'));
  
  -- Remove leading/trailing hyphens
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
  
  -- Ensure slug is not empty
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'brand';
  END IF;
  
  -- Start with base slug
  final_slug := base_slug;
  
  -- Check for uniqueness (excluding current brand_id)
  WHILE EXISTS (
    SELECT 1 FROM brands 
    WHERE slug = final_slug 
    AND id != brand_id
  ) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- Create trigger function for auto-slug generation
CREATE OR REPLACE FUNCTION brands_generate_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only generate if slug is NULL or if name changed
  IF NEW.slug IS NULL OR (TG_OP = 'UPDATE' AND NEW.name != OLD.name) THEN
    NEW.slug := generate_brand_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS brands_slug_trigger ON brands;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER brands_slug_trigger
  BEFORE INSERT OR UPDATE OF name ON brands
  FOR EACH ROW
  EXECUTE FUNCTION brands_generate_slug();

-- Backfill: Fix malformed slugs and names
-- 1. Fix brands with malformed slugs (missing first letter, etc.)
UPDATE brands
SET 
  slug = generate_brand_slug(name, id),
  updated_at = NOW()
WHERE 
  slug IS NULL
  OR slug ~ '^[^a-z]'  -- starts with non-letter
  OR slug ~ '--'        -- has double hyphens
  OR slug ~ '^-|-$'     -- starts or ends with hyphen
  OR LENGTH(slug) < 2;  -- too short

-- 2. Fix brands with "Unnamed" or placeholder names
UPDATE brands
SET 
  name = CASE
    WHEN slug IS NOT NULL AND slug != '' THEN
      -- Convert slug to proper title case name
      INITCAP(REPLACE(slug, '-', ' '))
    ELSE
      'Brand ' || SUBSTRING(id::TEXT FROM 1 FOR 8)
  END,
  description = CASE
    WHEN description = 'No Wikidata entry found' OR description LIKE '%placeholder%' THEN
      'Brand information pending enrichment'
    ELSE description
  END,
  updated_at = NOW()
WHERE 
  LOWER(name) LIKE '%unnamed%'
  OR LOWER(name) LIKE '%placeholder%'
  OR name = ''
  OR name IS NULL;

-- 3. Regenerate slugs for all fixed names
UPDATE brands
SET slug = generate_brand_slug(name, id)
WHERE slug IS NULL OR slug = '';

-- Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);

-- Add comment for documentation
COMMENT ON FUNCTION generate_brand_slug IS 'Generates a unique URL-safe slug from brand name and ID';
COMMENT ON TRIGGER brands_slug_trigger ON brands IS 'Automatically generates slug when brand name changes';