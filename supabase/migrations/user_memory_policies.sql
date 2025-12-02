-- USER_MEMORY CONSOLIDATED POLICIES
-- Reference implementation for optimized RLS policies
-- User-isolated access - each user can only access their own memory records

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own memory" ON public.user_memory;
DROP POLICY IF EXISTS "Users can manage their own memory" ON public.user_memory;

-- Service role: full access
CREATE POLICY user_memory_service_all ON public.user_memory
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users: SELECT own memory only
CREATE POLICY user_memory_user_select ON public.user_memory
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- Authenticated users: manage their own memory
CREATE POLICY user_memory_user_insert ON public.user_memory
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY user_memory_user_update ON public.user_memory
FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY user_memory_user_delete ON public.user_memory
FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);
