-- Fix RLS policies for pilot_brands table (admin-only access)
ALTER TABLE public.pilot_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pilot brands"
  ON public.pilot_brands
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));