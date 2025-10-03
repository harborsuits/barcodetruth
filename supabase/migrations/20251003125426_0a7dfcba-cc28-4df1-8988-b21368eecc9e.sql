-- Store job execution summaries
CREATE TABLE IF NOT EXISTS public.job_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name         TEXT NOT NULL,
  mode             TEXT NOT NULL,
  user_id          UUID,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  duration_ms      INTEGER,
  status           TEXT NOT NULL DEFAULT 'started',
  success_count    INTEGER NOT NULL DEFAULT 0,
  error_count      INTEGER NOT NULL DEFAULT 0,
  anomalies_count  INTEGER NOT NULL DEFAULT 0,
  details          JSONB
);

-- Store anomalies for drill-down
CREATE TABLE IF NOT EXISTS public.job_anomalies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_run_id   UUID NOT NULL REFERENCES public.job_runs(id) ON DELETE CASCADE,
  brand_id     UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  delta        INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_runs_started_at ON public.job_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_runs_name_mode ON public.job_runs(job_name, mode, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_anomalies_job ON public.job_anomalies(job_run_id);
CREATE INDEX IF NOT EXISTS idx_job_anomalies_brand ON public.job_anomalies(brand_id);

-- RLS
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_anomalies ENABLE ROW LEVEL SECURITY;

-- Admins can read job runs
CREATE POLICY "job_runs_read_admin"
  ON public.job_runs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Admins can read anomalies
CREATE POLICY "job_anomalies_read_admin"
  ON public.job_anomalies FOR SELECT
  USING (has_role(auth.uid(), 'admin'));
