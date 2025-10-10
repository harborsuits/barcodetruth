-- =====================================================
-- SECURITY REMEDIATION: Push Notifications & Data Cleanup
-- =====================================================

-- STEP 1: Remove plaintext push credential columns
-- Since table is empty, this is safe to do immediately
ALTER TABLE public.user_push_subs 
    DROP COLUMN IF EXISTS auth CASCADE,
    DROP COLUMN IF EXISTS p256dh CASCADE;

-- Make encrypted columns NOT NULL and required
ALTER TABLE public.user_push_subs 
    ALTER COLUMN auth_enc_b64 SET NOT NULL,
    ALTER COLUMN p256dh_enc_b64 SET NOT NULL;

-- STEP 2: Add notification log cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_notification_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Delete logs older than 90 days
    DELETE FROM public.notification_log 
    WHERE sent_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION public.cleanup_old_notification_logs() IS 
'Deletes notification logs older than 90 days. Should be called daily via cron job.';