-- REPORT_LOGS CONSOLIDATED POLICIES
-- Reference implementation for optimized RLS policies
-- Conversation-based access control for report logs

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their report logs" ON public.report_logs;
DROP POLICY IF EXISTS "Users can manage their report logs" ON public.report_logs;

-- Service role: full access
CREATE POLICY report_logs_service_all ON public.report_logs
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users: SELECT logs where chat_id is NULL or user has conversation access
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

-- Authenticated users: protected writes (must have conversation access)
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
