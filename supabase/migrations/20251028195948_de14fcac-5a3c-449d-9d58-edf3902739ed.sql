-- Delete all users except admin user ben04537
DO $$
DECLARE
  admin_id uuid;
BEGIN
  -- Find the admin user ID by email pattern
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email LIKE '%ben04537%'
  LIMIT 1;

  -- Delete all users except the admin
  -- This will cascade to profiles, user_roles, user_scans, etc.
  DELETE FROM auth.users
  WHERE id != admin_id;
  
  RAISE NOTICE 'Deleted all users except admin (%). Admin ID: %', 
    (SELECT email FROM auth.users WHERE id = admin_id), 
    admin_id;
END $$;