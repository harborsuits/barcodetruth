-- Create brand_data_mappings table for deterministic source queries
CREATE TABLE IF NOT EXISTS public.brand_data_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'OSHA' | 'EPA' | 'FDA' | 'FEC'
  external_id TEXT NULL, -- optional provider-specific id
  query TEXT NULL,       -- provider query string (e.g., firm_name=Unilever)
  label TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brand_data_mappings_brand ON public.brand_data_mappings(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_data_mappings_source ON public.brand_data_mappings(source);

-- RLS
ALTER TABLE public.brand_data_mappings ENABLE ROW LEVEL SECURITY;

-- Public can read mappings
DROP POLICY IF EXISTS brand_data_mappings_read ON public.brand_data_mappings;
CREATE POLICY brand_data_mappings_read
ON public.brand_data_mappings
FOR SELECT
USING (true);

-- Admins can manage mappings
DROP POLICY IF EXISTS brand_data_mappings_write_admin ON public.brand_data_mappings;
CREATE POLICY brand_data_mappings_write_admin
ON public.brand_data_mappings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_bdmap()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_updated_at_bdmap ON public.brand_data_mappings;
CREATE TRIGGER trg_set_updated_at_bdmap
BEFORE UPDATE ON public.brand_data_mappings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_bdmap();