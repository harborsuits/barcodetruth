
-- Brand categories lookup table
CREATE TABLE public.brand_categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial categories
INSERT INTO public.brand_categories (slug, name) VALUES
  ('food-beverages', 'Food & Beverages'),
  ('personal-care', 'Personal Care'),
  ('household', 'Household'),
  ('electronics', 'Electronics'),
  ('apparel', 'Apparel'),
  ('health-wellness', 'Health & Wellness'),
  ('baby-kids', 'Baby & Kids'),
  ('pet-care', 'Pet Care'),
  ('automotive', 'Automotive'),
  ('home-garden', 'Home & Garden'),
  ('other', 'Other');

ALTER TABLE public.brand_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read brand_categories" ON public.brand_categories FOR SELECT USING (true);

-- Brand attributes (sustainable, local, b_corp, etc.)
CREATE TABLE public.brand_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  attribute_type TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  confidence NUMERIC(3,2) DEFAULT 0.50,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(brand_id, attribute_type)
);

CREATE INDEX idx_brand_attributes_brand ON public.brand_attributes(brand_id);
CREATE INDEX idx_brand_attributes_type ON public.brand_attributes(attribute_type);

ALTER TABLE public.brand_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read brand_attributes" ON public.brand_attributes FOR SELECT USING (true);
CREATE POLICY "Admins can manage brand_attributes" ON public.brand_attributes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Brand alternatives (precomputed)
CREATE TABLE public.brand_alternatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  alternative_brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'Higher alignment',
  score NUMERIC(5,2) DEFAULT 0,
  alternative_type TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(brand_id, alternative_brand_id, alternative_type)
);

CREATE INDEX idx_brand_alternatives_brand ON public.brand_alternatives(brand_id);
CREATE INDEX idx_brand_alternatives_type ON public.brand_alternatives(alternative_type);

ALTER TABLE public.brand_alternatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read brand_alternatives" ON public.brand_alternatives FOR SELECT USING (true);
CREATE POLICY "Admins can manage brand_alternatives" ON public.brand_alternatives FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Add category_slug to brands if not exists
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS category_slug TEXT REFERENCES public.brand_categories(slug);

-- Add region to user_preferences for local alternatives
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- RPC: Get alternatives for a brand by type
CREATE OR REPLACE FUNCTION public.get_brand_alternatives(p_brand_id UUID, p_type TEXT DEFAULT 'green')
RETURNS TABLE(
  alternative_brand_id UUID,
  brand_name TEXT,
  parent_company TEXT,
  logo_url TEXT,
  reason TEXT,
  score NUMERIC,
  score_environment INTEGER,
  score_labor INTEGER,
  score_politics INTEGER,
  score_social INTEGER,
  attributes TEXT[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ba.alternative_brand_id,
    b.name AS brand_name,
    b.parent_company,
    b.logo_url,
    ba.reason,
    ba.score,
    bs.score_environment,
    bs.score_labor,
    bs.score_politics,
    bs.score_social,
    ARRAY(
      SELECT bat.attribute_type 
      FROM brand_attributes bat 
      WHERE bat.brand_id = ba.alternative_brand_id 
        AND bat.confidence >= 0.5
    ) AS attributes
  FROM brand_alternatives ba
  JOIN brands b ON b.id = ba.alternative_brand_id AND b.is_active = true
  LEFT JOIN brand_scores bs ON bs.brand_id = ba.alternative_brand_id
  WHERE ba.brand_id = p_brand_id
    AND ba.alternative_type = p_type
  ORDER BY ba.score DESC
  LIMIT 10;
END;
$$;

-- RPC: Get completeness metrics for admin dashboard
CREATE OR REPLACE FUNCTION public.get_brand_completeness_metrics()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_brands', (SELECT COUNT(*) FROM brands WHERE is_active = true),
    'brands_with_ownership', (
      SELECT COUNT(DISTINCT co.child_brand_id)
      FROM company_ownership co
      JOIN brands b ON b.id = co.child_brand_id AND b.is_active = true
    ),
    'brands_with_evidence', (
      SELECT COUNT(DISTINCT be.brand_id)
      FROM brand_events be
      JOIN brands b ON b.id = be.brand_id AND b.is_active = true
      WHERE be.is_irrelevant = false
    ),
    'brands_with_alternatives', (
      SELECT COUNT(DISTINCT ba.brand_id) FROM brand_alternatives ba
    ),
    'brands_with_scores', (SELECT COUNT(*) FROM brand_scores),
    'scan_total', (SELECT COUNT(*) FROM user_scans),
    'scan_resolved', (
      SELECT COUNT(*) FROM user_scans WHERE brand_id IS NOT NULL
    ),
    'unknown_barcodes_pending', (
      SELECT COUNT(*) FROM products WHERE brand_id IS NULL
    ),
    'brands_with_attributes', (
      SELECT COUNT(DISTINCT brand_id) FROM brand_attributes
    )
  ) INTO result;
  RETURN result;
END;
$$;
