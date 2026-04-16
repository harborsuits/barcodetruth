-- 1. Accent-insensitive search
CREATE OR REPLACE FUNCTION public.search_catalog(p_q text, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  result jsonb;
  q_norm text := public.unaccent(lower(p_q));
BEGIN
  WITH product_matches AS (
    SELECT 
      p.id, p.name, p.category, p.brand_id, p.barcode,
      similarity(public.unaccent(lower(p.name)), q_norm) as sim
    FROM products p
    WHERE (length(q_norm) < 3 AND public.unaccent(lower(p.name)) ILIKE q_norm || '%')
       OR (length(q_norm) >= 3 AND (public.unaccent(lower(p.name)) ILIKE '%' || q_norm || '%' OR similarity(public.unaccent(lower(p.name)), q_norm) > 0.3))
    ORDER BY sim DESC, p.name
    LIMIT p_limit
  ),
  brand_matches AS (
    SELECT 
      b.id, b.name, b.parent_company,
      similarity(public.unaccent(lower(b.name)), q_norm) as sim
    FROM brands b
    WHERE b.status = 'active'
      AND ((length(q_norm) < 3 AND public.unaccent(lower(b.name)) ILIKE q_norm || '%')
       OR (length(q_norm) >= 3 AND (public.unaccent(lower(b.name)) ILIKE '%' || q_norm || '%' OR similarity(public.unaccent(lower(b.name)), q_norm) > 0.3)))
    ORDER BY sim DESC, b.name
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'products', COALESCE((SELECT jsonb_agg(to_jsonb(pm.*)) FROM product_matches pm), '[]'::jsonb),
    'brands', COALESCE((SELECT jsonb_agg(to_jsonb(bm.*)) FROM brand_matches bm), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$function$;

-- Helper IMMUTABLE wrapper so we can use it in functional indexes
CREATE OR REPLACE FUNCTION public.unaccent_lower_immutable(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, lower(t)) $$;

-- Functional GIN indexes for fast accent-insensitive trigram search
CREATE INDEX IF NOT EXISTS idx_brands_name_unaccent_trgm
  ON public.brands USING gin (public.unaccent_lower_immutable(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_name_unaccent_trgm
  ON public.products USING gin (public.unaccent_lower_immutable(name) gin_trgm_ops);

-- 2. Soft-gate Add Product
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS community_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submission_photo_url text,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'approved' CHECK (review_status IN ('pending','approved','rejected'));

COMMENT ON COLUMN public.products.review_status IS 'approved (default for system-ingested or admin-approved); pending (community-submitted, awaiting review); rejected (removed)';

CREATE INDEX IF NOT EXISTS idx_products_review_status_pending
  ON public.products (created_at DESC)
  WHERE review_status = 'pending';

-- 3. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-submissions', 'product-submissions', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload submission photos to own folder" ON storage.objects;
CREATE POLICY "Users can upload submission photos to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can view their own submission photos" ON storage.objects;
CREATE POLICY "Users can view their own submission photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Admins can view all submission photos" ON storage.objects;
CREATE POLICY "Admins can view all submission photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-submissions'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Admins can delete submission photos" ON storage.objects;
CREATE POLICY "Admins can delete submission photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-submissions'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );