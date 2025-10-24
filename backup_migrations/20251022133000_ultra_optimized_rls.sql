-- ULTRA-OPTIMIZED RLS FOR MESSAGES
-- Absolute bare minimum - only SELECT and INSERT for users
-- Service role bypasses RLS completely

-- 1. DROP ALL EXISTING POLICIES ON MESSAGES
DROP POLICY IF EXISTS "Service role can delete messages" ON public.messages;
DROP POLICY IF EXISTS "service_role_manage_messages" ON public.messages;
DROP POLICY IF EXISTS "users_view_accessible_messages" ON public.messages;
DROP POLICY IF EXISTS "users_insert_accessible_messages" ON public.messages;
DROP POLICY IF EXISTS "service_role_full_access" ON public.messages;
DROP POLICY IF EXISTS "users_select_messages" ON public.messages;
DROP POLICY IF EXISTS "users_insert_messages" ON public.messages;

-- 2. ENSURE REPLICA IDENTITY IS DEFAULT (not FULL)
-- FULL sends all columns on every broadcast (slow)
-- DEFAULT only sends primary key + changed columns (fast)
ALTER TABLE public.messages REPLICA IDENTITY DEFAULT;

-- 3. DROP OLD HELPER FUNCTION IF EXISTS
DROP FUNCTION IF EXISTS public.user_has_chat_access(uuid, uuid);

-- 4. CREATE INLINE POLICIES (no function overhead)
-- Service role: full access, no RLS evaluation
CREATE POLICY "svc_all" ON public.messages
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users: SELECT only from accessible conversations
CREATE POLICY "usr_sel" ON public.messages
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = chat_id AND user_id = auth.uid()
      LIMIT 1
    )
    OR EXISTS (
      SELECT 1 FROM conversations_participants 
      WHERE conversation_id = chat_id AND user_id = auth.uid()
      LIMIT 1
    )
  );

-- Users: INSERT only into accessible conversations
CREATE POLICY "usr_ins" ON public.messages
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = chat_id AND user_id = auth.uid()
      LIMIT 1
    )
    OR EXISTS (
      SELECT 1 FROM conversations_participants 
      WHERE conversation_id = chat_id AND user_id = auth.uid()
      LIMIT 1
    )
  );

-- 5. ENSURE COMPOSITE INDEXES EXIST (for fast EXISTS queries)
CREATE INDEX IF NOT EXISTS idx_conv_id_user 
  ON public.conversations(id, user_id);

CREATE INDEX IF NOT EXISTS idx_part_conv_user 
  ON public.conversations_participants(conversation_id, user_id);

-- 6. VERIFY NO UPDATE/DELETE POLICIES
-- Messages are never updated/deleted by users, only by service_role via CASCADE

-- Performance optimizations:
-- ✅ No function call overhead (inline EXISTS)
-- ✅ LIMIT 1 stops at first match
-- ✅ OR allows short-circuit evaluation
-- ✅ Composite indexes for direct lookups
-- ✅ Replica identity DEFAULT (minimal broadcast payload)
-- ✅ No redundant service_role policies
-- ✅ No UPDATE/DELETE policies (not needed)

COMMENT ON TABLE public.messages IS 'Ultra-optimized for realtime broadcasts';

