-- Atomic ingest run ledger for race-proof cooldown
CREATE TABLE IF NOT EXISTS public.ingest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  slot_start TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
  new_events INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (brand_id, slot_start)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ingest_runs_brand_slot ON public.ingest_runs(brand_id, slot_start DESC);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_status ON public.ingest_runs(status, created_at DESC);

-- Enable RLS
ALTER TABLE public.ingest_runs ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can view ingest runs"
  ON public.ingest_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON TABLE public.ingest_runs IS 'Atomic ledger for news ingestion runs with 15-min slot deduplication';