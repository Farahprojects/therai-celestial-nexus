-- CHAT_FOLDERS CONSOLIDATED POLICIES
-- Reference implementation for optimized RLS policies
-- This consolidates multiple permissive policies into efficient merged policies

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Participants can view their folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Public can view public folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Users can manage own folders" ON public.chat_folders;

-- Service role: full access
CREATE POLICY chat_folders_service_all ON public.chat_folders
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Public users: read access to public folders only
CREATE POLICY chat_folders_public_read ON public.chat_folders
FOR SELECT TO public
USING (is_public = true);

-- Authenticated users: merged access (owners + participants + public)
CREATE POLICY chat_folders_user_select_merged ON public.chat_folders
FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR is_public = true
  OR EXISTS (
    SELECT 1 FROM public.chat_folder_participants p
    WHERE p.folder_id = chat_folders.id
      AND p.user_id = (select auth.uid())
  )
);

-- Authenticated users: manage their own folders
CREATE POLICY chat_folders_user_insert ON public.chat_folders
FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY chat_folders_user_update ON public.chat_folders
FOR UPDATE TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY chat_folders_user_delete ON public.chat_folders
FOR DELETE TO authenticated
USING (user_id = (select auth.uid()));
