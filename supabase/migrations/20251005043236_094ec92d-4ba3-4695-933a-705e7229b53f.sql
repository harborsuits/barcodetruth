-- Add text mirror columns for easier encrypted credential handling
-- These store the base64-encoded encrypted credentials directly
ALTER TABLE public.user_push_subs
  ADD COLUMN IF NOT EXISTS auth_enc_b64 TEXT,
  ADD COLUMN IF NOT EXISTS p256dh_enc_b64 TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS user_push_subs_user_endpoint_idx 
  ON public.user_push_subs(user_id, endpoint);

-- Add a helper function to check migration status
CREATE OR REPLACE FUNCTION public.check_push_encryption_status()
RETURNS TABLE(
  total_subs BIGINT,
  encrypted_count BIGINT,
  plaintext_count BIGINT,
  encryption_complete BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*) as total_subs,
    COUNT(*) FILTER (WHERE auth_enc_b64 IS NOT NULL AND p256dh_enc_b64 IS NOT NULL) as encrypted_count,
    COUNT(*) FILTER (WHERE auth IS NOT NULL OR p256dh IS NOT NULL) as plaintext_count,
    (COUNT(*) FILTER (WHERE auth IS NOT NULL OR p256dh IS NOT NULL)) = 0 as encryption_complete
  FROM public.user_push_subs;
$$;

-- Grant execute to authenticated users (they can check their own migration status)
GRANT EXECUTE ON FUNCTION public.check_push_encryption_status() TO authenticated;