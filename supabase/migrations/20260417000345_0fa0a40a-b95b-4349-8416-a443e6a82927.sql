-- 1. Canonical normalization function (matches edge function logic)
CREATE OR REPLACE FUNCTION public.compute_brand_normalized_key(input_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result TEXT;
BEGIN
  IF input_name IS NULL OR length(trim(input_name)) = 0 THEN
    RETURN '';
  END IF;

  result := lower(input_name);
  result := regexp_replace(result, '^the\s+', '', 'i');
  result := regexp_replace(
    result,
    '\m(inc|incorporated|corp|corporation|co|company|llc|ltd|limited|plc|gmbh|sa|ag|nv|holdings|group|brands|foods|beverages|international|global|worldwide|enterprises)\M\.?',
    '',
    'gi'
  );
  result := regexp_replace(result, '[^a-z0-9]+', '', 'g');
  RETURN trim(result);
END;
$$;

-- 2. Add normalized_name columns
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS normalized_name TEXT;
ALTER TABLE public.brand_aliases ADD COLUMN IF NOT EXISTS normalized_name TEXT;

-- 3. Backfill
UPDATE public.brands
SET normalized_name = public.compute_brand_normalized_key(name)
WHERE normalized_name IS NULL OR normalized_name = '';

UPDATE public.brand_aliases
SET normalized_name = public.compute_brand_normalized_key(external_name)
WHERE normalized_name IS NULL OR normalized_name = '';

-- 4. Triggers to keep normalized_name in sync
CREATE OR REPLACE FUNCTION public.brands_set_normalized_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.normalized_name := public.compute_brand_normalized_key(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brands_set_normalized_name ON public.brands;
CREATE TRIGGER trg_brands_set_normalized_name
BEFORE INSERT OR UPDATE OF name ON public.brands
FOR EACH ROW
EXECUTE FUNCTION public.brands_set_normalized_name();

CREATE OR REPLACE FUNCTION public.aliases_set_normalized_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.normalized_name := public.compute_brand_normalized_key(NEW.external_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aliases_set_normalized_name ON public.brand_aliases;
CREATE TRIGGER trg_aliases_set_normalized_name
BEFORE INSERT OR UPDATE OF external_name ON public.brand_aliases
FOR EACH ROW
EXECUTE FUNCTION public.aliases_set_normalized_name();

-- 5. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_brands_normalized_name
  ON public.brands (normalized_name)
  WHERE normalized_name IS NOT NULL AND normalized_name <> '';

CREATE INDEX IF NOT EXISTS idx_aliases_normalized_name
  ON public.brand_aliases (normalized_name)
  WHERE normalized_name IS NOT NULL AND normalized_name <> '';

CREATE INDEX IF NOT EXISTS idx_display_profiles_normalized_name
  ON public.brand_display_profiles (normalized_name)
  WHERE normalized_name IS NOT NULL AND normalized_name <> '';