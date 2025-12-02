-- CRITICAL SECURITY FIX: Remove hardcoded JWT tokens from database functions
-- This migration updates functions that were created with hardcoded credentials
-- to use the secure credential functions instead
-- Note: Legacy functions call_process_guest_report_pdf and rpc_notify_orchestrator
-- have been dropped as they are no longer needed

-- Update the update_buffer_pending_count function from 20250214000000_intelligent_memory_buffer.sql
-- This function was using hardcoded anon key JWT token and needs to be updated to use secure credential retrieval
CREATE OR REPLACE FUNCTION public.update_buffer_pending_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  new_count integer;
  conv_user_id uuid;
  supabase_url text;
  anon_key text;
  function_url text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Increment pending count and capture the updated value
    UPDATE public.conversation_activity
    SET
      pending_buffer_count = pending_buffer_count + 1,
      updated_at = pg_catalog.now()
    WHERE conversation_id = NEW.conversation_id
    RETURNING pending_buffer_count, user_id
    INTO new_count, conv_user_id;

    -- Auto-trigger processing when threshold reached
    IF new_count >= 5 THEN
      -- Get Supabase URL and anon key securely
      supabase_url := public.get_supabase_url();
      anon_key := public.get_anon_key();

      IF supabase_url = '' OR anon_key = '' THEN
        RAISE WARNING 'Supabase URL or anon key not configured. Skipping edge function call.';
        RETURN NEW;
      END IF;

      function_url := supabase_url || '/functions/v1/process-memory-buffer';

      PERFORM net.http_post(
        function_url,
        pg_catalog.jsonb_build_object(
          'conversation_id', NEW.conversation_id,
          'user_id', conv_user_id,
          'trigger_reason', 'count_threshold'
        ),
        '{}'::jsonb, -- empty params
        pg_catalog.jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key
        )
      );

      UPDATE public.conversation_activity
      SET buffer_processing_scheduled = true
      WHERE conversation_id = NEW.conversation_id;

      RAISE LOG '[update_buffer_pending_count] Auto-triggered processing for conversation % (count: %)', NEW.conversation_id, new_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Add security comment
COMMENT ON FUNCTION public.update_buffer_pending_count() IS 'Secure version: Gets credentials from vault instead of hardcoded JWT tokens';

-- ============================================================================
-- CHAT_FOLDERS RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate multiple permissive policies into efficient merged policies
-- This reduces RLS initplan evaluation overhead and improves performance
-- Uses (select auth.uid()) pattern for better query optimization

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Participants can view their folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Public can view public folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Users can manage own folders" ON public.chat_folders;
DROP POLICY IF EXISTS "chat_folders_user_select" ON public.chat_folders;
DROP POLICY IF EXISTS "chat_folders_user_select_merged" ON public.chat_folders;

-- Recreate consolidated chat_folders policies

CREATE POLICY chat_folders_service_all ON public.chat_folders
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY chat_folders_public_read ON public.chat_folders
FOR SELECT TO public
USING (is_public = true);

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

-- ============================================================================
-- INSIGHTS RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate insights policies for better performance
-- Insights inherit folder access permissions

-- First, drop existing insights policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own insights" ON public.insights;
DROP POLICY IF EXISTS "Users can manage their own insights" ON public.insights;
DROP POLICY IF EXISTS "insights_user_select" ON public.insights;
DROP POLICY IF EXISTS "insights_user_insert" ON public.insights;
DROP POLICY IF EXISTS "insights_user_update" ON public.insights;
DROP POLICY IF EXISTS "insights_user_delete" ON public.insights;

-- Recreate consolidated insights policies

-- 1) Service role: full access
CREATE POLICY insights_service_all ON public.insights
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) Authenticated: SELECT own or via folder membership; INSERT/UPDATE/DELETE own
CREATE POLICY insights_user_select ON public.insights
FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = insights.folder_id
      AND cf.user_id = (select auth.uid())
  )
);

CREATE POLICY insights_user_insert ON public.insights
FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY insights_user_update ON public.insights
FOR UPDATE TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY insights_user_delete ON public.insights
FOR DELETE TO authenticated
USING (user_id = (select auth.uid()));

-- ============================================================================
-- REPORT_LOGS RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate report_logs policies with conversation-based access control
-- Allows access to logs for conversations the user can access

-- First, drop existing report_logs policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their report logs" ON public.report_logs;
DROP POLICY IF EXISTS "Users can manage their report logs" ON public.report_logs;
DROP POLICY IF EXISTS "report_logs_user_select" ON public.report_logs;
DROP POLICY IF EXISTS "report_logs_user_insert" ON public.report_logs;
DROP POLICY IF EXISTS "report_logs_user_update" ON public.report_logs;
DROP POLICY IF EXISTS "report_logs_user_delete" ON public.report_logs;

-- Recreate consolidated report_logs policies

-- 1) Service role: full access
CREATE POLICY report_logs_service_all ON public.report_logs
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) Authenticated: SELECT if (a) chat_id is NULL, or (b) user is owner/participant/public via conversations
CREATE POLICY report_logs_user_select ON public.report_logs
FOR SELECT TO authenticated
USING (
  chat_id IS NULL OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = report_logs.chat_id
      AND (
        c.is_public = true OR
        (select auth.uid()) = COALESCE(c.owner_user_id, c.user_id) OR
        EXISTS (
          SELECT 1 FROM public.conversations_participants cp
          WHERE cp.conversation_id = c.id
            AND cp.user_id = (select auth.uid())
        )
      )
  )
);

-- 3) Authenticated: INSERT/UPDATE/DELETE only where the user has access to the same conversation (protects writes)
CREATE POLICY report_logs_user_insert ON public.report_logs
FOR INSERT TO authenticated
WITH CHECK (
  chat_id IS NULL OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = report_logs.chat_id
      AND (
        c.is_public = true OR
        (select auth.uid()) = COALESCE(c.owner_user_id, c.user_id) OR
        EXISTS (
          SELECT 1 FROM public.conversations_participants cp
          WHERE cp.conversation_id = c.id
            AND cp.user_id = (select auth.uid())
        )
      )
  )
);

CREATE POLICY report_logs_user_update ON public.report_logs
FOR UPDATE TO authenticated
USING (
  chat_id IS NULL OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = report_logs.chat_id
      AND (
        c.is_public = true OR
        (select auth.uid()) = COALESCE(c.owner_user_id, c.user_id) OR
        EXISTS (
          SELECT 1 FROM public.conversations_participants cp
          WHERE cp.conversation_id = c.id
            AND cp.user_id = (select auth.uid())
        )
      )
  )
)
WITH CHECK (
  chat_id IS NULL OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = report_logs.chat_id
      AND (
        c.is_public = true OR
        (select auth.uid()) = COALESCE(c.owner_user_id, c.user_id) OR
        EXISTS (
          SELECT 1 FROM public.conversations_participants cp
          WHERE cp.conversation_id = c.id
            AND cp.user_id = (select auth.uid())
        )
      )
  )
);

CREATE POLICY report_logs_user_delete ON public.report_logs
FOR DELETE TO authenticated
USING (
  chat_id IS NULL OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = report_logs.chat_id
      AND (
        c.is_public = true OR
        (select auth.uid()) = COALESCE(c.owner_user_id, c.user_id) OR
        EXISTS (
          SELECT 1 FROM public.conversations_participants cp
          WHERE cp.conversation_id = c.id
            AND cp.user_id = (select auth.uid())
        )
      )
  )
);

-- ============================================================================
-- USER_MEMORY_BUFFER RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate user_memory_buffer policies for user-isolated access
-- Each user can only access their own memory buffer records

-- First, drop existing user_memory_buffer policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own memory buffer" ON public.user_memory_buffer;
DROP POLICY IF EXISTS "Users can manage their own memory buffer" ON public.user_memory_buffer;
DROP POLICY IF EXISTS "user_memory_buffer_user_select" ON public.user_memory_buffer;
DROP POLICY IF EXISTS "user_memory_buffer_user_insert" ON public.user_memory_buffer;
DROP POLICY IF EXISTS "user_memory_buffer_user_update" ON public.user_memory_buffer;
DROP POLICY IF EXISTS "user_memory_buffer_user_delete" ON public.user_memory_buffer;

-- Recreate consolidated user_memory_buffer policies

-- 1) service_role: full access
CREATE POLICY user_memory_buffer_service_all ON public.user_memory_buffer
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) authenticated: SELECT own only
CREATE POLICY user_memory_buffer_user_select ON public.user_memory_buffer
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- 3) authenticated: INSERT/UPDATE/DELETE own only
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

-- ============================================================================
-- USER_MEMORY RLS POLICY OPTIMIZATION
-- ============================================================================
-- Consolidate user_memory policies for user-isolated access
-- Each user can only access their own memory records

-- First, drop existing user_memory policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own memory" ON public.user_memory;
DROP POLICY IF EXISTS "Users can manage their own memory" ON public.user_memory;
DROP POLICY IF EXISTS "user_memory_user_select" ON public.user_memory;
DROP POLICY IF EXISTS "user_memory_user_insert" ON public.user_memory;
DROP POLICY IF EXISTS "user_memory_user_update" ON public.user_memory;
DROP POLICY IF EXISTS "user_memory_user_delete" ON public.user_memory;

-- Recreate consolidated user_memory policies

-- 1) service_role: full access
CREATE POLICY user_memory_service_all ON public.user_memory
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2) authenticated: SELECT own only
CREATE POLICY user_memory_user_select ON public.user_memory
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- 3) authenticated: INSERT/UPDATE/DELETE own only
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
