-- 1. Backfill category_slug for the 8 strong-zone brands (manual mapping based on known categories)
UPDATE brands SET category_slug='food-beverages' WHERE id='0257d5ff-61a8-4881-bec3-d9457c4701f0' AND category_slug IS NULL; -- READY (snacks/protein)
UPDATE brands SET category_slug='food-beverages' WHERE id='06d296d2-c8d7-412f-b53f-45cdb32a670e' AND category_slug IS NULL; -- HP Sauce
UPDATE brands SET category_slug='food-beverages' WHERE id='6585590f-01bf-415f-af93-e81264ec1623' AND category_slug IS NULL; -- Sunshine
UPDATE brands SET category_slug='food-beverages' WHERE id='70337855-7e09-455a-8590-5c1539ef5be7' AND category_slug IS NULL; -- Morton (salt)
UPDATE brands SET category_slug='personal-care'  WHERE id='7e75e42a-bae7-4e6b-b86b-1e73786c68b7' AND category_slug IS NULL; -- Crest (toothpaste)
UPDATE brands SET category_slug='food-beverages' WHERE id='ff6846fe-7faf-425a-a2c2-d10a373d5d42' AND category_slug IS NULL; -- Trident (gum)
UPDATE brands SET category_slug='food-beverages' WHERE id='175b22b0-92f8-40ce-8a07-a164b72c99ef' AND category_slug IS NULL; -- Louisiana (hot sauce)
UPDATE brands SET category_slug='food-beverages' WHERE id='c5104c94-ec2a-4bc7-b872-91ce7a0ccc78' AND category_slug IS NULL; -- Lindt

-- 2. Coverage requests table for the "Request priority coverage" CTA
CREATE TABLE IF NOT EXISTS public.coverage_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  brand_id uuid,
  brand_name text,
  barcode text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coverage_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can request coverage"
  ON public.coverage_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users read own coverage requests"
  ON public.coverage_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all coverage requests"
  ON public.coverage_requests FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update coverage requests"
  ON public.coverage_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_coverage_requests_brand ON public.coverage_requests(brand_id);
CREATE INDEX IF NOT EXISTS idx_coverage_requests_status ON public.coverage_requests(status, created_at DESC);

-- 3. Bump priority in brand_enrichment_queue when coverage is requested
CREATE OR REPLACE FUNCTION public.request_brand_coverage(
  p_brand_id uuid DEFAULT NULL,
  p_brand_name text DEFAULT NULL,
  p_barcode text DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.coverage_requests(user_id, brand_id, brand_name, barcode, reason)
  VALUES (auth.uid(), p_brand_id, p_brand_name, p_barcode, p_reason)
  RETURNING id INTO v_id;

  -- Bump enrichment queue if a brand_id was provided
  IF p_brand_id IS NOT NULL THEN
    INSERT INTO public.brand_enrichment_queue(brand_id, task, status, next_run_at)
    VALUES (p_brand_id, 'priority_coverage', 'pending', now())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_brand_coverage(uuid, text, text, text) TO authenticated;