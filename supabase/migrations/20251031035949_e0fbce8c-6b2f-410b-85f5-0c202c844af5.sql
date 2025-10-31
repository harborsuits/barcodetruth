-- Fix storage bucket policies with unique names
-- Drop old policies that might conflict
DROP POLICY IF EXISTS "seed_files_public_read" ON storage.objects;
DROP POLICY IF EXISTS "seed_files_auth_upload" ON storage.objects;

-- Create properly scoped policies for seed-files bucket
CREATE POLICY "seed_files_public_read_v2" ON storage.objects
FOR SELECT USING (bucket_id = 'seed-files');

CREATE POLICY "seed_files_auth_upload_v2" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'seed-files' AND auth.role() = 'authenticated');