-- Unknown barcodes intake table
CREATE TABLE IF NOT EXISTS public.unknown_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL,
  normalized_barcode text NOT NULL GENERATED ALWAYS AS (public.normalize_barcode(barcode)) STORED,
  scan_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  resolved_product_id uuid REFERENCES public.products(id),
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT uq_unknown_barcodes_barcode UNIQUE (barcode)
);

CREATE INDEX idx_unknown_barcodes_status ON public.unknown_barcodes(status);
CREATE INDEX idx_unknown_barcodes_scan_count ON public.unknown_barcodes(scan_count DESC);
CREATE INDEX idx_unknown_barcodes_normalized ON public.unknown_barcodes(normalized_barcode);

ALTER TABLE public.unknown_barcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on unknown_barcodes"
  ON public.unknown_barcodes FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anon can insert unknown barcodes"
  ON public.unknown_barcodes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Admin metrics RPC
CREATE OR REPLACE FUNCTION public.get_product_coverage_metrics()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_products', (SELECT count(*) FROM products),
    'products_with_brand', (SELECT count(*) FROM products WHERE brand_id IS NOT NULL),
    'products_with_category', (SELECT count(*) FROM products WHERE category IS NOT NULL AND category != ''),
    'total_brands', (SELECT count(*) FROM brands),
    'brands_with_company', (
      SELECT count(DISTINCT co.child_brand_id) 
      FROM company_ownership co 
      WHERE co.child_brand_id IS NOT NULL
    ),
    'total_companies', (SELECT count(*) FROM companies),
    'unknown_barcodes_pending', (SELECT count(*) FROM unknown_barcodes WHERE status = 'pending'),
    'unknown_barcodes_total', (SELECT count(*) FROM unknown_barcodes),
    'top_unknown_barcodes', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT barcode, scan_count, first_seen_at, last_seen_at
        FROM unknown_barcodes
        WHERE status = 'pending'
        ORDER BY scan_count DESC
        LIMIT 10
      ) t
    ),
    'products_by_source', (
      SELECT coalesce(jsonb_object_agg(coalesce(source, 'unknown'), cnt), '{}'::jsonb)
      FROM (SELECT source, count(*) as cnt FROM products GROUP BY source) s
    ),
    'scan_resolution_rate', (
      SELECT CASE WHEN total > 0 THEN round((resolved::numeric / total) * 100, 1) ELSE 0 END
      FROM (
        SELECT count(*) as total,
               count(*) FILTER (WHERE brand_id IS NOT NULL) as resolved
        FROM user_scans
      ) x
    )
  );
$$;

-- Function to log unknown barcode with increment
CREATE OR REPLACE FUNCTION public.log_unknown_barcode(p_barcode text, p_user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO unknown_barcodes (barcode, user_agent)
  VALUES (p_barcode, p_user_agent)
  ON CONFLICT (barcode)
  DO UPDATE SET
    scan_count = unknown_barcodes.scan_count + 1,
    last_seen_at = now();
END;
$$;
