
-- Create the update_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add person ratings table for rating CEOs, founders, and key figures
CREATE TABLE IF NOT EXISTS public.person_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES company_people(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('leadership', 'ethics', 'transparency', 'social_impact', 'environmental', 'labor_practices')),
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  context_note TEXT,
  evidence_url TEXT,
  weight NUMERIC NOT NULL DEFAULT 1.0,
  ip_hash TEXT,
  ua_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, person_id, category)
);

-- Enable RLS
ALTER TABLE public.person_ratings ENABLE ROW LEVEL SECURITY;

-- Users can view their own ratings
CREATE POLICY "Users can view their own person ratings"
ON public.person_ratings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own ratings
CREATE POLICY "Users can insert their own person ratings"
ON public.person_ratings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update their own person ratings"
ON public.person_ratings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all person ratings
CREATE POLICY "Admins can view all person ratings"
ON public.person_ratings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete ratings (moderation)
CREATE POLICY "Admins can delete person ratings"
ON public.person_ratings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create index for better performance
CREATE INDEX idx_person_ratings_person_id ON public.person_ratings(person_id);
CREATE INDEX idx_person_ratings_user_id ON public.person_ratings(user_id);
CREATE INDEX idx_person_ratings_created_at ON public.person_ratings(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_person_ratings_updated_at
  BEFORE UPDATE ON public.person_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.person_ratings IS 'Community ratings for key people (CEOs, founders, etc.)';
