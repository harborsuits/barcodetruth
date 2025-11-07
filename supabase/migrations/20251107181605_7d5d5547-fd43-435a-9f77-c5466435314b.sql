-- Create rejected_entities table for brand-match logging
CREATE TABLE IF NOT EXISTS public.rejected_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  rejection_reason TEXT NOT NULL,
  source_table TEXT,
  source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for querying
CREATE INDEX IF NOT EXISTS idx_rejected_entities_created_at 
  ON public.rejected_entities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rejected_entities_type 
  ON public.rejected_entities(entity_type);

-- Enable RLS
ALTER TABLE public.rejected_entities ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admin read rejected entities" 
  ON public.rejected_entities 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.uid() = id 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );