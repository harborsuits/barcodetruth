-- Create jobs table for background task queue
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  not_before timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  locked_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  coalesce_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient job polling
CREATE INDEX IF NOT EXISTS idx_jobs_pending
  ON public.jobs (not_before, created_at)
  WHERE locked_by IS NULL;

-- Index for stage filtering
CREATE INDEX IF NOT EXISTS idx_jobs_stage
  ON public.jobs (stage);

-- Unique index for burst coalescing (pending jobs only)
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_stage_coalesce_pending
  ON public.jobs (stage, coalesce_key)
  WHERE locked_by IS NULL AND coalesce_key IS NOT NULL;

-- Dead letter queue for failed jobs
CREATE TABLE IF NOT EXISTS public.jobs_dead (
  id uuid PRIMARY KEY,
  stage text NOT NULL,
  payload jsonb NOT NULL,
  attempts int NOT NULL,
  last_error text,
  original_created_at timestamptz,
  moved_to_dead_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: service role only (jobs are system-level)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs_dead ENABLE ROW LEVEL SECURITY;

-- RPC to unlock stale jobs
CREATE OR REPLACE FUNCTION public.unlock_stale_jobs(timeout_seconds int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unlocked_count int;
BEGIN
  WITH unlocked AS (
    UPDATE public.jobs
    SET locked_by = NULL, locked_at = NULL
    WHERE locked_by IS NOT NULL
      AND locked_at < (now() - (timeout_seconds || ' seconds')::interval)
    RETURNING id
  )
  SELECT count(*) INTO unlocked_count FROM unlocked;
  
  RETURN unlocked_count;
END;
$$;

-- RPC to count brand events in last 24h (for flood control) - fixed type
CREATE OR REPLACE FUNCTION public.brand_events_last_24h(brand_id_param uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM brand_events
  WHERE brand_id = brand_id_param
    AND created_at >= now() - interval '24 hours';
$$;

-- RPC to atomically upsert coalesced jobs
CREATE OR REPLACE FUNCTION public.upsert_coalesced_job(
  p_stage text,
  p_key text,
  p_payload jsonb,
  p_not_before timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Try to insert a fresh job
  INSERT INTO public.jobs(stage, coalesce_key, payload, not_before)
  VALUES (p_stage, p_key, p_payload, p_not_before)
  ON CONFLICT (stage, coalesce_key)
  WHERE jobs.locked_by IS NULL
  DO UPDATE SET
    -- Merge events array; keep earliest not_before
    payload = jsonb_set(
      COALESCE(jobs.payload, '{}'::jsonb),
      '{events}',
      COALESCE(jobs.payload->'events','[]'::jsonb) || COALESCE(p_payload->'events','[]'::jsonb),
      true
    ),
    not_before = LEAST(jobs.not_before, p_not_before),
    attempts = 0;
END;
$$;