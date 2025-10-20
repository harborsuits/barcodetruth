-- Create public storage bucket for brand logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-logos', 'brand-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Public read brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Service role manages brand logos" ON storage.objects;

-- Allow public read access to brand logos
CREATE POLICY "Public read brand logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'brand-logos');

-- Service role can upload/update brand logos
CREATE POLICY "Service role manages brand logos"
ON storage.objects FOR ALL
USING (bucket_id = 'brand-logos')
WITH CHECK (bucket_id = 'brand-logos');