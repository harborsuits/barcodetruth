-- Telemetry table for resolver runs
CREATE TABLE IF NOT EXISTS public.evidence_resolution_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  processed int NOT NULL DEFAULT 0,
  resolved int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  mode text NOT NULL,
  notes jsonb
);

-- Index for recent runs lookup
CREATE INDEX IF NOT EXISTS evidence_resolution_runs_started_idx 
  ON public.evidence_resolution_runs(started_at DESC);

-- RLS: admins can view, service role can insert/update
ALTER TABLE public.evidence_resolution_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view resolution runs"
  ON public.evidence_resolution_runs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage resolution runs"
  ON public.evidence_resolution_runs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add evidence_status enum if not exists (for tracking resolution state)
DO $$ BEGIN
  CREATE TYPE evidence_status AS ENUM ('pending', 'resolved', 'no_evidence', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add evidence_status column to event_sources if not exists
ALTER TABLE public.event_sources 
  ADD COLUMN IF NOT EXISTS evidence_status text DEFAULT 'pending';

-- Index for pending sources lookup
CREATE INDEX IF NOT EXISTS event_sources_evidence_status_idx 
  ON public.event_sources(evidence_status) 
  WHERE evidence_status = 'pending';