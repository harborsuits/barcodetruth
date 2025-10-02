-- Create brand_ownerships table for tracking corporate hierarchies
CREATE TABLE public.brand_ownerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  parent_brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('subsidiary_of', 'division_of', 'brand_of', 'acquired_by')),
  effective_date DATE,
  source TEXT NOT NULL,
  source_url TEXT,
  confidence INTEGER CHECK (confidence >= 1 AND confidence <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(brand_id, parent_brand_id)
);

-- Add optional enrichment fields to brands
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS wikidata_qid TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;

-- Enable RLS
ALTER TABLE public.brand_ownerships ENABLE ROW LEVEL SECURITY;

-- Public read for ownership data
CREATE POLICY "Public read brand_ownerships"
ON public.brand_ownerships
FOR SELECT
USING (true);

-- Admins can manage ownership data
CREATE POLICY "Admins can manage brand_ownerships"
ON public.brand_ownerships
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookups
CREATE INDEX idx_brand_ownerships_brand ON public.brand_ownerships(brand_id);
CREATE INDEX idx_brand_ownerships_parent ON public.brand_ownerships(parent_brand_id);
CREATE INDEX idx_brand_ownerships_confidence ON public.brand_ownerships(confidence);

-- Trigger to update updated_at
CREATE TRIGGER update_brand_ownerships_updated_at
  BEFORE UPDATE ON public.brand_ownerships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_preferences_updated_at();