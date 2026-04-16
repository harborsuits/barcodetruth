CREATE TABLE public.brand_corrections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  proposed_name text,
  proposed_website text,
  proposed_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brand_corrections_brand ON public.brand_corrections(brand_id);
CREATE INDEX idx_brand_corrections_status ON public.brand_corrections(status) WHERE status = 'pending';
CREATE INDEX idx_brand_corrections_submitter ON public.brand_corrections(submitter_user_id);

ALTER TABLE public.brand_corrections ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can submit a correction
CREATE POLICY "Authenticated users can submit corrections"
  ON public.brand_corrections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND submitter_user_id = auth.uid());

-- Submitters can see their own submissions
CREATE POLICY "Submitters can view their own corrections"
  ON public.brand_corrections
  FOR SELECT
  TO authenticated
  USING (submitter_user_id = auth.uid());

-- Admins can view all
CREATE POLICY "Admins can view all corrections"
  ON public.brand_corrections
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can update (review)
CREATE POLICY "Admins can update corrections"
  ON public.brand_corrections
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete
CREATE POLICY "Admins can delete corrections"
  ON public.brand_corrections
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Auto-update updated_at
CREATE TRIGGER update_brand_corrections_updated_at
  BEFORE UPDATE ON public.brand_corrections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();