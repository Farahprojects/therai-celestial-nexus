-- USER_MEMORY_BUFFER CONSOLIDATED POLICIES
-- Reference implementation for optimized RLS policies
-- User-isolated access - each user can only access their own memory buffer

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own memory buffer" ON public.user_memory_buffer;
DROP POLICY IF EXISTS "Users can manage their own memory buffer" ON public.user_memory_buffer;

-- Service role: full access
CREATE POLICY user_memory_buffer_service_all ON public.user_memory_buffer
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users: SELECT own memory buffer only
CREATE POLICY user_memory_buffer_user_select ON public.user_memory_buffer
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- Authenticated users: manage their own memory buffer
CREATE POLICY user_memory_buffer_user_insert ON public.user_memory_buffer
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY user_memory_buffer_user_update ON public.user_memory_buffer
FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY user_memory_buffer_user_delete ON public.user_memory_buffer
FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);
