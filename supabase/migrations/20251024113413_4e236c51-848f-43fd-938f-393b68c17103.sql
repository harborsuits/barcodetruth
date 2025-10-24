-- Enable RLS on asset_managers table
ALTER TABLE public.asset_managers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all authenticated users
CREATE POLICY "Asset managers are viewable by authenticated users"
ON public.asset_managers
FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow admins to manage asset managers
CREATE POLICY "Admins can manage asset managers"
ON public.asset_managers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);