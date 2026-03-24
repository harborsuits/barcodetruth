
-- Daily coverage snapshots table to track backlog reduction over time
CREATE TABLE IF NOT EXISTS public.coverage_daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  never_checked_count integer NOT NULL DEFAULT 0,
  stale_count integer NOT NULL DEFAULT 0,
  quiet_count integer NOT NULL DEFAULT 0,
  active_count integer NOT NULL DEFAULT 0,
  hot_count integer NOT NULL DEFAULT 0,
  total_active_brands integer NOT NULL DEFAULT 0,
  brands_checked_24h integer NOT NULL DEFAULT 0,
  brands_checked_7d integer NOT NULL DEFAULT 0,
  brands_checked_30d integer NOT NULL DEFAULT 0,
  total_products integer NOT NULL DEFAULT 0,
  brand_linked_pct numeric(5,2) NOT NULL DEFAULT 0,
  company_linked_pct numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(snapshot_date)
);

ALTER TABLE public.coverage_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read coverage snapshots" ON public.coverage_daily_snapshots
  FOR SELECT TO authenticated USING (true);

-- Function to record a daily snapshot
CREATE OR REPLACE FUNCTION public.record_coverage_snapshot()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total_products integer;
  v_brand_linked integer;
  v_company_linked integer;
BEGIN
  SELECT COUNT(*) INTO v_total_products FROM products;
  SELECT COUNT(*) INTO v_brand_linked FROM products WHERE brand_id IS NOT NULL;
  SELECT COUNT(*) INTO v_company_linked FROM products WHERE company_id IS NOT NULL;

  INSERT INTO coverage_daily_snapshots (
    snapshot_date,
    never_checked_count,
    stale_count,
    quiet_count,
    active_count,
    hot_count,
    total_active_brands,
    brands_checked_24h,
    brands_checked_7d,
    brands_checked_30d,
    total_products,
    brand_linked_pct,
    company_linked_pct
  )
  SELECT
    CURRENT_DATE,
    COUNT(*) FILTER (WHERE COALESCE(news_coverage_status,'never_checked') = 'never_checked'),
    COUNT(*) FILTER (WHERE news_coverage_status = 'stale'),
    COUNT(*) FILTER (WHERE news_coverage_status = 'quiet'),
    COUNT(*) FILTER (WHERE news_coverage_status = 'active'),
    COUNT(*) FILTER (WHERE news_coverage_status = 'hot'),
    COUNT(*),
    COUNT(*) FILTER (WHERE last_news_check_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE last_news_check_at > now() - interval '7 days'),
    COUNT(*) FILTER (WHERE last_news_check_at > now() - interval '30 days'),
    v_total_products,
    CASE WHEN v_total_products > 0 THEN ROUND(v_brand_linked * 100.0 / v_total_products, 2) ELSE 0 END,
    CASE WHEN v_total_products > 0 THEN ROUND(v_company_linked * 100.0 / v_total_products, 2) ELSE 0 END
  FROM brands
  WHERE is_active = true
  ON CONFLICT (snapshot_date) DO UPDATE SET
    never_checked_count = EXCLUDED.never_checked_count,
    stale_count = EXCLUDED.stale_count,
    quiet_count = EXCLUDED.quiet_count,
    active_count = EXCLUDED.active_count,
    hot_count = EXCLUDED.hot_count,
    total_active_brands = EXCLUDED.total_active_brands,
    brands_checked_24h = EXCLUDED.brands_checked_24h,
    brands_checked_7d = EXCLUDED.brands_checked_7d,
    brands_checked_30d = EXCLUDED.brands_checked_30d,
    total_products = EXCLUDED.total_products,
    brand_linked_pct = EXCLUDED.brand_linked_pct,
    company_linked_pct = EXCLUDED.company_linked_pct,
    created_at = now();
END;
$$;
