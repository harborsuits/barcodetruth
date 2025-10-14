-- Enable RLS on cron_runs table
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role can manage cron runs"
ON cron_runs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow admins to view
CREATE POLICY "Admins can view cron runs"
ON cron_runs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));