-- Add indexes for efficient rate limiting lookups
CREATE INDEX IF NOT EXISTS idx_fn_call_rate_user
  ON public.fn_call_log(user_id, fn, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fn_call_rate_ip
  ON public.fn_call_log(requester_ip, fn, created_at DESC)
  WHERE requester_ip IS NOT NULL;