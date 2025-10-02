-- Create generic set_updated_at function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix brand_ownerships trigger
DROP TRIGGER IF EXISTS update_brand_ownerships_updated_at ON public.brand_ownerships;
CREATE TRIGGER update_brand_ownerships_updated_at
  BEFORE UPDATE ON public.brand_ownerships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Create ownership_relation enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ownership_relation') THEN
    CREATE TYPE ownership_relation AS ENUM ('brand_of','division_of','subsidiary_of','acquired_by');
  END IF;
END$$;

-- Update relationship_type to use enum
ALTER TABLE public.brand_ownerships
  DROP CONSTRAINT IF EXISTS brand_ownerships_relationship_type_check;

ALTER TABLE public.brand_ownerships
  ALTER COLUMN relationship_type TYPE ownership_relation USING relationship_type::ownership_relation;

-- Add better uniqueness constraint (including relationship for future-proofing)
ALTER TABLE public.brand_ownerships
  DROP CONSTRAINT IF EXISTS brand_ownerships_brand_id_parent_brand_id_key;

ALTER TABLE public.brand_ownerships
  ADD CONSTRAINT brand_ownerships_unique UNIQUE (brand_id, parent_brand_id, relationship_type);