-- Create user_follows table for brand following and notification preferences
CREATE TABLE IF NOT EXISTS public.user_follows (
  user_id uuid NOT NULL,
  brand_id text NOT NULL,
  notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, brand_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_follows_brand_enabled
  ON public.user_follows (brand_id)
  WHERE notifications_enabled = true;

CREATE INDEX IF NOT EXISTS idx_push_subs_user
  ON public.user_push_subs (user_id);

-- Enable RLS
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can manage their own follows
CREATE POLICY "Users can view own follows"
  ON public.user_follows
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own follows"
  ON public.user_follows
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own follows"
  ON public.user_follows
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own follows"
  ON public.user_follows
  FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-populate user_id from auth context (don't trust client)
CREATE OR REPLACE FUNCTION public.set_user_id_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_set_user_id_follows ON public.user_follows;
CREATE TRIGGER t_set_user_id_follows
  BEFORE INSERT ON public.user_follows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_id_default();