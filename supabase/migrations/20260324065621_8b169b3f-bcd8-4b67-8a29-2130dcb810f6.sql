CREATE TABLE IF NOT EXISTS public.regulatory_match_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name text NOT NULL,
  normalized_firm text NOT NULL,
  source_adapter text NOT NULL,
  source_record_id text NOT NULL,
  suggested_brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  suggested_brand_name text,
  match_confidence text NOT NULL,
  similarity_score numeric(4,3) DEFAULT 0,
  matched_via text,
  record_title text,
  record_date timestamptz,
  raw_data jsonb,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(source_adapter, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_reg_match_review_status ON public.regulatory_match_review(status);
CREATE INDEX IF NOT EXISTS idx_reg_match_review_confidence ON public.regulatory_match_review(match_confidence, similarity_score DESC);

ALTER TABLE public.regulatory_match_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage regulatory match reviews"
  ON public.regulatory_match_review
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));