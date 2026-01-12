-- 1. Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Create clean slug generation function
CREATE OR REPLACE FUNCTION public.generate_clean_slug(input_name text)
RETURNS text AS $$
  SELECT trim(both '-' from lower(
    regexp_replace(
      regexp_replace(
        unaccent(coalesce(input_name,'')),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  ));
$$ LANGUAGE sql IMMUTABLE;

-- 3. Update all slugs with collision-safe de-duplication
WITH base AS (
  SELECT id, generate_clean_slug(name) AS base_slug
  FROM public.brands
),
ranked AS (
  SELECT id, base_slug,
    ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY id) AS rn
  FROM base
),
final AS (
  SELECT id,
    CASE WHEN rn = 1 THEN base_slug ELSE base_slug || '-' || rn END AS new_slug
  FROM ranked
)
UPDATE public.brands b
SET slug = f.new_slug
FROM final f
WHERE b.id = f.id AND b.slug IS DISTINCT FROM f.new_slug;

-- 4. Create aliases table for SEO/human typing resilience
CREATE TABLE IF NOT EXISTS public.brand_slug_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL UNIQUE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_slug_aliases_alias
ON public.brand_slug_aliases(alias);

-- 5. Enable RLS with public read
ALTER TABLE public.brand_slug_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_aliases"
ON public.brand_slug_aliases FOR SELECT USING (true);

-- 6. Seed common aliases (old truncated slugs + common variations)
INSERT INTO public.brand_slug_aliases (alias, brand_id)
SELECT 'nestl', id FROM public.brands WHERE name = 'Nestlé'
ON CONFLICT (alias) DO NOTHING;