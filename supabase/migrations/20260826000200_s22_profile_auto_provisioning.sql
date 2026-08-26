-- S2.2 Profile Auto-Provisioning Migration
-- QuickSpeak LMS Database Schema
-- Trigger-based profile creation on auth.users INSERT

-- Create trigger function for auto-provisioning profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Extract full_name from user metadata, with safe fallback
  -- Fallback: use email local part (before @) if metadata is missing
  DECLARE
    v_full_name TEXT;
    v_email_local TEXT;
  BEGIN
    -- Try to get full_name from metadata, treating whitespace-only as missing
    v_full_name := NULLIF(
      btrim(NEW.raw_user_meta_data ->> 'full_name'),
      ''
    );
    
    -- If full_name is NULL or empty, use email local part as fallback
    IF v_full_name IS NULL OR v_full_name = '' THEN
      -- Extract local part from email (everything before @)
      v_email_local := split_part(NEW.email, '@', 1);
      v_full_name := COALESCE(v_email_local, 'User');
    END IF;
    
    -- Insert profile with defaults, avoiding duplicates
    INSERT INTO public.profiles (
      id,
      full_name,
      email,
      role,
      status
    )
    VALUES (
      NEW.id,
      v_full_name,
      NEW.email,
      'student',
      'waiting'
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
  END;
END;
$$;

-- Create trigger on auth.users to fire on INSERT
-- This trigger will auto-provision a profile when a new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
