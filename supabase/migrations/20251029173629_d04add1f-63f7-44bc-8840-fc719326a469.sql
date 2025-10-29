-- Delete all users who are not admins
-- This will cascade delete their profiles, scans, and other data
DELETE FROM auth.users
WHERE id NOT IN (
  SELECT user_id 
  FROM public.user_roles 
  WHERE role = 'admin'
);