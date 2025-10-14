-- Create storage bucket for snapshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('snapshots', 'snapshots', true, 52428800, ARRAY['application/json'])
ON CONFLICT (id) DO NOTHING;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Public read snapshots" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage snapshots" ON storage.objects;

CREATE POLICY "Public read snapshots" ON storage.objects FOR SELECT TO public USING (bucket_id = 'snapshots');
CREATE POLICY "Service role can manage snapshots" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'snapshots') WITH CHECK (bucket_id = 'snapshots');

-- Trigger pipeline (pull immediately, then schedule the rest)
SELECT net.http_post(url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-pull-feeds', headers := '{"Content-Type": "application/json"}'::jsonb);

SELECT cron.schedule('pipeline-match', '15 seconds', $$ SELECT net.http_post(url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-brand-match', headers := '{"Content-Type": "application/json"}'::jsonb); SELECT cron.unschedule('pipeline-match'); $$);
SELECT cron.schedule('pipeline-resolve', '30 seconds', $$ SELECT net.http_post(url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-resolve-evidence', headers := '{"Content-Type": "application/json"}'::jsonb); SELECT cron.unschedule('pipeline-resolve'); $$);
SELECT cron.schedule('pipeline-calc', '45 seconds', $$ SELECT net.http_post(url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/cron-calc-baselines', headers := '{"Content-Type": "application/json"}'::jsonb); SELECT cron.unschedule('pipeline-calc'); $$);
SELECT cron.schedule('pipeline-snap', '59 seconds', $$ SELECT net.http_post(url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/publish-snapshots', headers := '{"Content-Type": "application/json"}'::jsonb); SELECT cron.unschedule('pipeline-snap'); $$);