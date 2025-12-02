-- PROFILES CONSOLIDATED POLICIES
-- Reference implementation for optimized RLS policies
-- User profiles with restricted insert operations

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Service role: full access
CREATE POLICY profiles_service_all ON public.profiles
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users: SELECT/UPDATE own profile only
CREATE POLICY profiles_user_select ON public.profiles
FOR SELECT TO authenticated
USING ((select auth.uid()) = id);

CREATE POLICY profiles_user_update ON public.profiles
FOR UPDATE TO authenticated
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);

-- INSERT: Reserved for service role only
-- Users cannot create their own profiles - handled by auth triggers/service role
