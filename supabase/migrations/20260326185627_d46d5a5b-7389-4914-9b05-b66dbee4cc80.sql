
-- Staging table for brand seeding (temporary, no triggers)
CREATE TABLE IF NOT EXISTS public.brand_seed_stage (
  id serial PRIMARY KEY,
  name text NOT NULL,
  website text,
  category_slug text,
  is_independent boolean DEFAULT true,
  parent_company text,
  rejected boolean DEFAULT false,
  reject_reason text,
  created_at timestamptz DEFAULT now()
);

-- No RLS needed - admin-only table
ALTER TABLE public.brand_seed_stage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only access" ON public.brand_seed_stage
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
