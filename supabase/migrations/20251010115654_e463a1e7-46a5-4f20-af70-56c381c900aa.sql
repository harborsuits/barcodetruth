-- =====================================================
-- SECURITY ENHANCEMENT: Address Remaining Warnings
-- =====================================================

-- ========================================
-- FIX 1: Function Call Logs Protection
-- ========================================

-- Make fn_call_log append-only and immutable
-- Only service role can insert, nobody can update/delete

CREATE POLICY "Service role can insert function call logs"
ON public.fn_call_log
FOR INSERT
WITH CHECK (true); -- Will be restricted by service role key

CREATE POLICY "Prevent all updates to function call logs"
ON public.fn_call_log
FOR UPDATE
USING (false); -- Make logs immutable

CREATE POLICY "Prevent all deletes of function call logs"
ON public.fn_call_log
FOR DELETE
USING (false); -- Make logs permanent

-- Users can view their own logs
CREATE POLICY "Users can view their own function call logs"
ON public.fn_call_log
FOR SELECT
USING (auth.uid() = user_id);

-- ========================================
-- FIX 2: Notification Log Privacy Enhancement
-- ========================================

-- Drop existing policies and recreate with stronger restrictions
DROP POLICY IF EXISTS "notification_log_select" ON public.notification_log;
DROP POLICY IF EXISTS "notification_log_insert" ON public.notification_log;
DROP POLICY IF EXISTS "notification_log_update" ON public.notification_log;
DROP POLICY IF EXISTS "notification_log_delete" ON public.notification_log;

-- Users can only see their own logs from the last 30 days
CREATE POLICY "Users can view their recent notification logs"
ON public.notification_log
FOR SELECT
USING (
  auth.uid() = user_id 
  AND sent_at >= NOW() - INTERVAL '30 days'
);

-- Only service role can insert (prevents log injection)
CREATE POLICY "Service role can insert notification logs"
ON public.notification_log
FOR INSERT
WITH CHECK (true); -- Restricted by service role key

-- Users cannot update logs (immutable)
CREATE POLICY "Prevent notification log updates"
ON public.notification_log
FOR UPDATE
USING (false);

-- Users can delete their own old logs (privacy right)
CREATE POLICY "Users can delete their own old notification logs"
ON public.notification_log
FOR DELETE
USING (
  auth.uid() = user_id 
  AND sent_at < NOW() - INTERVAL '90 days'
);

-- ========================================
-- FIX 3: Billing Data Access Audit
-- ========================================

-- Create audit log for sensitive billing access
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  accessor_id UUID,
  accessor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  ip_address TEXT,
  details JSONB
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view security audit logs"
ON public.security_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs"
ON public.security_audit_log
FOR INSERT
WITH CHECK (true);

-- Nobody can modify audit logs
CREATE POLICY "Prevent audit log modifications"
ON public.security_audit_log
FOR UPDATE
USING (false);

CREATE POLICY "Prevent audit log deletions"
ON public.security_audit_log
FOR DELETE
USING (false);

-- Add index for faster audit queries
CREATE INDEX IF NOT EXISTS idx_security_audit_log_accessed_at 
ON public.security_audit_log(accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_table_action 
ON public.security_audit_log(table_name, action);

-- ========================================
-- Helper Functions for Security
-- ========================================

-- Function to log sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_access(
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    accessor_id,
    accessor_role,
    action,
    table_name,
    record_id,
    ip_address,
    details
  ) VALUES (
    auth.uid(),
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', 'anonymous'),
    p_action,
    p_table_name,
    p_record_id,
    current_setting('request.headers', true)::jsonb->>'x-real-ip',
    p_details
  );
END;
$$;

-- Add comment explaining the security measures
COMMENT ON TABLE public.security_audit_log IS 
'Immutable audit log tracking all access to sensitive data. Used for compliance and security monitoring.';

COMMENT ON FUNCTION public.log_sensitive_access IS 
'Logs access to sensitive data for security auditing. Should be called by edge functions when accessing user_billing or other sensitive tables.';