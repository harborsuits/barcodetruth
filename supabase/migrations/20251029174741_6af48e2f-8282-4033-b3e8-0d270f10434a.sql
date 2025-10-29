-- Admin visibility for user management
-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_scans ENABLE ROW LEVEL SECURITY;

-- Admin can read all profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Admin read all profiles'
  ) THEN
    CREATE POLICY "Admin read all profiles"
      ON public.profiles
      FOR SELECT
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Users can read their own profile (safety, in case missing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users read own profile'
  ) THEN
    CREATE POLICY "Users read own profile"
      ON public.profiles
      FOR SELECT
      USING (auth.uid() = id);
  END IF;
END $$;

-- Admin can read all roles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Admin read all user_roles'
  ) THEN
    CREATE POLICY "Admin read all user_roles"
      ON public.user_roles
      FOR SELECT
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Users can read their own roles (safety)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Users read own user_roles'
  ) THEN
    CREATE POLICY "Users read own user_roles"
      ON public.user_roles
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Admin can read all user_scans
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_scans' AND policyname = 'Admin read all user_scans'
  ) THEN
    CREATE POLICY "Admin read all user_scans"
      ON public.user_scans
      FOR SELECT
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Users can read their own scans (safety)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_scans' AND policyname = 'Users read own user_scans'
  ) THEN
    CREATE POLICY "Users read own user_scans"
      ON public.user_scans
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;