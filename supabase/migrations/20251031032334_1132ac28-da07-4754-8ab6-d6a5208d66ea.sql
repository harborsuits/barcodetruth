-- Create public storage bucket for seed files
INSERT INTO storage.buckets (id, name, public)
VALUES ('seed-files', 'seed-files', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload access" ON storage.objects;

-- Allow public read access
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'seed-files');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated upload access" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'seed-files' AND auth.role() = 'authenticated');