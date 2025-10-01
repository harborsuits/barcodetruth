-- ========================================
-- SHIP-IT: CRITICAL SECURITY & DATA INTEGRITY
-- ========================================

-- A) Create is_admin() function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- B) Unique constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_barcode_unique'
  ) THEN
    ALTER TABLE public.products ADD CONSTRAINT products_barcode_unique UNIQUE (barcode);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_sources_event_url_unique'
  ) THEN
    ALTER TABLE public.event_sources ADD CONSTRAINT event_sources_event_url_unique UNIQUE (event_id, source_url);
  END IF;
END $$;

-- C) Performance indexes
CREATE INDEX IF NOT EXISTS brand_events_brand_date_idx 
  ON public.brand_events (brand_id, event_date DESC);

CREATE INDEX IF NOT EXISTS brand_events_verification_date_idx 
  ON public.brand_events (verification, event_date DESC);

CREATE INDEX IF NOT EXISTS event_sources_url_pattern_idx 
  ON public.event_sources USING btree (source_url text_pattern_ops);

CREATE INDEX IF NOT EXISTS brand_events_category_idx 
  ON public.brand_events (category, event_date DESC);

-- D) Brand aliases table
CREATE TABLE IF NOT EXISTS public.brand_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_name text NOT NULL,
  canonical_brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by uuid,
  UNIQUE (external_name, source)
);

CREATE INDEX IF NOT EXISTS brand_aliases_external_idx 
  ON public.brand_aliases (external_name, source);

ALTER TABLE public.brand_aliases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'brand_aliases_read_all' AND tablename = 'brand_aliases'
  ) THEN
    CREATE POLICY brand_aliases_read_all ON public.brand_aliases
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'brand_aliases_write_admin' AND tablename = 'brand_aliases'
  ) THEN
    CREATE POLICY brand_aliases_write_admin ON public.brand_aliases
      FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;