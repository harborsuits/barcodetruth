
CREATE TABLE public.fuzzy_alias_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_name text NOT NULL,
  matched_brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  matched_brand_name text,
  similarity_score numeric(4,3),
  source text NOT NULL DEFAULT 'openfoodfacts_fuzzy',
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fuzzy_alias_review_status ON public.fuzzy_alias_review(status);
CREATE INDEX idx_fuzzy_alias_review_created ON public.fuzzy_alias_review(created_at DESC);

ALTER TABLE public.fuzzy_alias_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fuzzy alias reviews"
  ON public.fuzzy_alias_review
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
