-- ADMIN ROLE MANAGEMENT SYSTEM
-- Reference implementation for role-based admin access control
-- Complete admin authorization system with helper function and policies

-- Helper: admin check via existing membership
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  );
$$;

-- Revoke execute permissions from regular users (service role only)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, authenticated;

-- Ensure single admin-only policies for user_roles table
DO $$
BEGIN
  -- Admin SELECT access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='user_roles'
      AND policyname='Admin select user_roles'
  ) THEN
    EXECUTE '
      CREATE POLICY "Admin select user_roles" ON public.user_roles
      FOR SELECT TO authenticated
      USING (public.is_admin());
    ';
  END IF;

  -- Admin INSERT access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='user_roles'
      AND policyname='Admin insert user_roles'
  ) THEN
    EXECUTE '
      CREATE POLICY "Admin insert user_roles" ON public.user_roles
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin());
    ';
  END IF;

  -- Admin UPDATE access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='user_roles'
      AND policyname='Admin update user_roles'
  ) THEN
    EXECUTE '
      CREATE POLICY "Admin update user_roles" ON public.user_roles
      FOR UPDATE TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
    ';
  END IF;

  -- Admin DELETE access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='user_roles'
      AND policyname='Admin delete user_roles'
  ) THEN
    EXECUTE '
      CREATE POLICY "Admin delete user_roles" ON public.user_roles
      FOR DELETE TO authenticated
      USING (public.is_admin());
    ';
  END IF;

END $$;

-- Helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
