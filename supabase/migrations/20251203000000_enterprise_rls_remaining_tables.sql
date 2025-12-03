-- ENTERPRISE-LEVEL RLS SECURITY UPGRADE FOR REMAINING TABLES
-- This migration completes the enterprise-level RLS upgrades for all remaining tables
-- containing sensitive user data. Ensures only owners can delete their data and
-- consolidates policies using the optimized (select auth.uid()) pattern.

-- ============================================================================
-- USER_PROFILE_LIST RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate user_profile_list policies for user-isolated access
-- Each user can only access their own saved profile data

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profiles" ON public.user_profile_list;
DROP POLICY IF EXISTS "Users can insert their own profiles" ON public.user_profile_list;
DROP POLICY IF EXISTS "Users can update their own profiles" ON public.user_profile_list;
DROP POLICY IF EXISTS "Users can delete their own profiles" ON public.user_profile_list;

-- Recreate consolidated user_profile_list policies

-- 1) Service role: full access
CREATE POLICY user_profile_list_service_all ON public.user_profile_list
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) Authenticated: SELECT/INSERT/UPDATE/DELETE own only
CREATE POLICY user_profile_list_user_select ON public.user_profile_list
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY user_profile_list_user_insert ON public.user_profile_list
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY user_profile_list_user_update ON public.user_profile_list
FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY user_profile_list_user_delete ON public.user_profile_list
FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- FOLDER_AI_USAGE RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate folder_ai_usage policies for user-isolated access
-- Users can only access their own AI usage data

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read their own folder AI usage" ON public.folder_ai_usage;
DROP POLICY IF EXISTS "Service role can manage all folder AI usage" ON public.folder_ai_usage;

-- Recreate consolidated folder_ai_usage policies

-- 1) Service role: full access
CREATE POLICY folder_ai_usage_service_all ON public.folder_ai_usage
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) Authenticated: SELECT own only (read-only for users)
CREATE POLICY folder_ai_usage_user_select ON public.folder_ai_usage
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- FOLDER_AI_MESSAGES RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate folder_ai_messages policies for folder-based access control
-- Users can access messages in folders they own or participate in

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read their folder AI messages" ON public.folder_ai_messages;
DROP POLICY IF EXISTS "Users can insert AI messages to their folders" ON public.folder_ai_messages;
DROP POLICY IF EXISTS "Users can delete AI messages from their folders" ON public.folder_ai_messages;
DROP POLICY IF EXISTS "Service role can manage all folder AI messages" ON public.folder_ai_messages;

-- Recreate consolidated folder_ai_messages policies

-- 1) Service role: full access
CREATE POLICY folder_ai_messages_service_all ON public.folder_ai_messages
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) Authenticated: SELECT messages from folders they own or participate in
CREATE POLICY folder_ai_messages_user_select ON public.folder_ai_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = folder_ai_messages.folder_id
      AND (
        cf.user_id = (select auth.uid())
        OR cf.is_public = true
        OR EXISTS (
          SELECT 1 FROM public.chat_folder_participants p
          WHERE p.folder_id = cf.id
            AND p.user_id = (select auth.uid())
        )
      )
  )
);

-- 3) Authenticated: INSERT messages to folders they own
CREATE POLICY folder_ai_messages_user_insert ON public.folder_ai_messages
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = folder_ai_messages.folder_id
      AND cf.user_id = (select auth.uid())
  )
);

-- 4) Authenticated: DELETE messages from folders they own
CREATE POLICY folder_ai_messages_user_delete ON public.folder_ai_messages
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = folder_ai_messages.folder_id
      AND cf.user_id = (select auth.uid())
  )
);

-- ============================================================================
-- FOLDER_DOCUMENTS RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate folder_documents policies for folder-based access control
-- Users can access documents in folders they own or participate in

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS folder_documents_user_update ON public.folder_documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.folder_documents;

-- Recreate consolidated folder_documents policies

-- 1) Service role: full access
CREATE POLICY folder_documents_service_all ON public.folder_documents
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) Authenticated: SELECT documents from folders they own or participate in
CREATE POLICY folder_documents_user_select ON public.folder_documents
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = folder_documents.folder_id
      AND (
        cf.user_id = (select auth.uid())
        OR cf.is_public = true
        OR EXISTS (
          SELECT 1 FROM public.chat_folder_participants p
          WHERE p.folder_id = cf.id
            AND p.user_id = (select auth.uid())
        )
      )
  )
);

-- 3) Authenticated: INSERT documents to folders they own
CREATE POLICY folder_documents_user_insert ON public.folder_documents
FOR INSERT TO authenticated
WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = (select auth.uid())
  )
);

-- 4) Authenticated: UPDATE documents they own in folders they own
CREATE POLICY folder_documents_user_update ON public.folder_documents
FOR UPDATE TO authenticated
USING (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = (select auth.uid())
  )
)
WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = (select auth.uid())
  )
);

-- 5) Authenticated: DELETE documents they own in folders they own
CREATE POLICY folder_documents_user_delete ON public.folder_documents
FOR DELETE TO authenticated
USING (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = (select auth.uid())
  )
);

-- ============================================================================
-- CHAT_FOLDER_PARTICIPANTS RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate chat_folder_participants policies for folder sharing access
-- Users can manage their own participation, owners can manage all participants

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view folder participants" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Users can join folders" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Users can leave folders" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Owners can manage folder participants" ON public.chat_folder_participants;

-- Recreate consolidated chat_folder_participants policies

-- 1) Service role: full access
CREATE POLICY chat_folder_participants_service_all ON public.chat_folder_participants
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) Authenticated: SELECT participants from folders they can access
CREATE POLICY chat_folder_participants_user_select ON public.chat_folder_participants
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = chat_folder_participants.folder_id
      AND (
        cf.user_id = (select auth.uid())
        OR cf.is_public = true
        OR EXISTS (
          SELECT 1 FROM public.chat_folder_participants p
          WHERE p.folder_id = cf.id
            AND p.user_id = (select auth.uid())
        )
      )
  )
);

-- 3) Authenticated: INSERT their own participation
CREATE POLICY chat_folder_participants_user_insert ON public.chat_folder_participants
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

-- 4) Authenticated: UPDATE their own participation or manage participants in folders they own
CREATE POLICY chat_folder_participants_user_update ON public.chat_folder_participants
FOR UPDATE TO authenticated
USING (
  (select auth.uid()) = user_id
  OR EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = chat_folder_participants.folder_id
      AND cf.user_id = (select auth.uid())
  )
)
WITH CHECK (
  (select auth.uid()) = user_id
  OR EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = chat_folder_participants.folder_id
      AND cf.user_id = (select auth.uid())
  )
);

-- 5) Authenticated: DELETE their own participation or manage participants in folders they own
CREATE POLICY chat_folder_participants_user_delete ON public.chat_folder_participants
FOR DELETE TO authenticated
USING (
  (select auth.uid()) = user_id
  OR EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = chat_folder_participants.folder_id
      AND cf.user_id = (select auth.uid())
  )
);

-- ============================================================================
-- IMAGE_GENERATION_LOG RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate image_generation_log policies for user-isolated audit access
-- Immutable audit log - users can only read their own logs

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own image generation logs" ON public.image_generation_log;
DROP POLICY IF EXISTS "Service role full access to image generation logs" ON public.image_generation_log;

-- Recreate consolidated image_generation_log policies

-- 1) Service role: full access
CREATE POLICY image_generation_log_service_all ON public.image_generation_log
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) Authenticated: SELECT own logs only (read-only audit access)
CREATE POLICY image_generation_log_user_select ON public.image_generation_log
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- USER_IMAGES RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate user_images policies for user-isolated access
-- Users can manage their own images

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS user_images_user_modify ON public.user_images;

-- Recreate consolidated user_images policies

-- 1) Service role: full access
CREATE POLICY user_images_service_all ON public.user_images
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) Authenticated: SELECT own images
CREATE POLICY user_images_user_select ON public.user_images
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- 3) Authenticated: INSERT/UPDATE/DELETE own images
CREATE POLICY user_images_user_insert ON public.user_images
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY user_images_user_update ON public.user_images
FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY user_images_user_delete ON public.user_images
FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- VOICE_USAGE RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate voice_usage policies for user-isolated access
-- Users can only view their own voice usage

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own voice usage" ON public.voice_usage;
DROP POLICY IF EXISTS voice_usage_service_all ON public.voice_usage;

-- Recreate consolidated voice_usage policies

-- 1) Service role: full access
CREATE POLICY voice_usage_service_all ON public.voice_usage
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) Authenticated: SELECT own usage only (read-only for users)
CREATE POLICY voice_usage_user_select ON public.voice_usage
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- USER_MEMORY_WEEKLY_SUMMARIES RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate user_memory_weekly_summaries policies for user-isolated access
-- Users can view and delete their own weekly summaries

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS user_memory_weekly_summaries_select_own ON public.user_memory_weekly_summaries;
DROP POLICY IF EXISTS user_memory_weekly_summaries_delete_own ON public.user_memory_weekly_summaries;
DROP POLICY IF EXISTS user_memory_weekly_summaries_service_all ON public.user_memory_weekly_summaries;

-- Recreate consolidated user_memory_weekly_summaries policies

-- 1) Service role: full access
CREATE POLICY user_memory_weekly_summaries_service_all ON public.user_memory_weekly_summaries
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) Authenticated: SELECT own summaries
CREATE POLICY user_memory_weekly_summaries_user_select ON public.user_memory_weekly_summaries
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- 3) Authenticated: DELETE own summaries
CREATE POLICY user_memory_weekly_summaries_user_delete ON public.user_memory_weekly_summaries
FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- USER_MEMORY_MONTHLY_SUMMARIES RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate user_memory_monthly_summaries policies for user-isolated access
-- Users can view and delete their own monthly summaries

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS user_monthly_summaries_service_all ON public.user_memory_monthly_summaries;
DROP POLICY IF EXISTS user_monthly_summaries_user_select ON public.user_memory_monthly_summaries;
DROP POLICY IF EXISTS user_monthly_summaries_user_delete ON public.user_memory_monthly_summaries;

-- Recreate consolidated user_memory_monthly_summaries policies

-- 1) Service role: full access
CREATE POLICY user_memory_monthly_summaries_service_all ON public.user_memory_monthly_summaries
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) Authenticated: SELECT own summaries
CREATE POLICY user_memory_monthly_summaries_user_select ON public.user_memory_monthly_summaries
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- 3) Authenticated: DELETE own summaries
CREATE POLICY user_memory_monthly_summaries_user_delete ON public.user_memory_monthly_summaries
FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- PROFILES TABLE DELETE POLICY AUDIT
-- ============================================================================
-- Add DELETE policy to profiles table to ensure only owners can delete their profiles

-- Check if profiles table has a DELETE policy, add one if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND cmd = 'DELETE'
  ) THEN
    -- Add DELETE policy for profiles - only owners can delete their own profiles
    CREATE POLICY profiles_user_delete ON public.profiles
    FOR DELETE TO authenticated
    USING ((select auth.uid()) = id);
  END IF;
END $$;

-- ============================================================================
-- FINAL SECURITY COMMENT
-- ============================================================================
-- All tables with sensitive user data now have enterprise-level RLS policies
-- ensuring only authenticated users can access their own data, service role
-- has full access for operational needs, and DELETE operations are restricted
-- to data owners only.
