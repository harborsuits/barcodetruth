-- Add email column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Update the trigger function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, onboarding_complete)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    FALSE
  )
  ON CONFLICT (id) 
  DO UPDATE SET email = NEW.email;
  
  RETURN NEW;
END;
$$;

-- Backfill existing users' emails
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT id, email FROM auth.users
  LOOP
    UPDATE public.profiles 
    SET email = user_record.email 
    WHERE id = user_record.id;
  END LOOP;
END $$;