-- ============================================
-- SECURE MESSAGES RLS POLICIES
-- Official migration documenting current live policies
-- ============================================

-- This migration documents the secure RLS policies currently deployed
-- for the messages table. These policies were implemented to fix
-- authorization gaps between conversations and messages access.

-- IMPORTANT: These policies are already live in production.
-- This migration serves as documentation only.

DO $$
BEGIN
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'MESSAGES RLS POLICIES - CURRENT SECURE STATE';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'This migration documents the secure RLS policies';
    RAISE NOTICE 'currently deployed for the messages table.';
    RAISE NOTICE '';
    RAISE NOTICE 'DO NOT RUN THIS MIGRATION - policies already exist.';
    RAISE NOTICE 'This serves as official documentation only.';
END $$;

-- =================================================================
-- CURRENT LIVE MESSAGES POLICIES (DOCUMENTATION ONLY)
-- =================================================================

/*
The following policies are currently deployed and should NOT be created again.
This section documents what exists in production for reference.

1. SERVICE ROLE POLICIES
   - msg_service_all: Full access for service role
   - svc_all: Legacy duplicate (was removed)

2. USER POLICIES
   - msg_select_participants: Secure read access with folder support
   - msg_insert_participants: Secure write access with folder support
   - msg_update_author: Update own messages only
   - msg_delete_author: Delete own messages only

3. SPECIAL POLICIES
   - users_can_view_own_messages_after_chat_deletion: Access own messages even if conversation deleted
*/

-- =================================================================
-- POLICY DEFINITIONS (FOR REFERENCE ONLY)
-- =================================================================

/*
-- msg_select_participants (SECURE - includes folder logic)
CREATE POLICY "msg_select_participants" ON public.messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.chat_id
    AND (
      -- Owner access (primary)
      c.user_id = auth.uid()
      -- Owner access (legacy column)
      OR c.owner_user_id = auth.uid()
      -- Public conversation
      OR c.is_public = true
      -- Direct conversation participant
      OR EXISTS (
        SELECT 1 FROM conversations_participants cp
        WHERE cp.conversation_id = c.id AND cp.user_id = auth.uid()
      )
      -- Folder participant with view permission
      OR (c.folder_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM chat_folder_participants cfp
        WHERE cfp.folder_id = c.folder_id
          AND cfp.user_id = auth.uid()
          AND cfp.can_view_conversations = true
      ))
    )
  )
);

-- msg_insert_participants (SECURE - includes folder logic)
CREATE POLICY "msg_insert_participants" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.chat_id
    AND (
      -- Owner access
      c.user_id = auth.uid()
      OR c.owner_user_id = auth.uid()
      -- Public conversation
      OR c.is_public = true
      -- Direct conversation participant
      OR EXISTS (
        SELECT 1 FROM conversations_participants cp
        WHERE cp.conversation_id = c.id AND cp.user_id = auth.uid()
      )
      -- Folder participant with view permission (can participate in folder conversations)
      OR (c.folder_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM chat_folder_participants cfp
        WHERE cfp.folder_id = c.folder_id
          AND cfp.user_id = auth.uid()
          AND cfp.can_view_conversations = true
      ))
    )
  )
);

-- msg_update_author (SECURE - own messages only)
CREATE POLICY "msg_update_author" ON public.messages
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- msg_delete_author (SECURE - own messages only)
CREATE POLICY "msg_delete_author" ON public.messages
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- users_can_view_own_messages_after_chat_deletion (SPECIAL - permissive)
CREATE POLICY "users_can_view_own_messages_after_chat_deletion" ON public.messages
FOR SELECT TO authenticated
USING (user_id = auth.uid());
*/

-- =================================================================
-- SECURITY NOTES
-- =================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'SECURITY IMPLEMENTATION NOTES';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ AUTHORIZATION CONSISTENCY:';
    RAISE NOTICE '   Messages policies now match conversations policies';
    RAISE NOTICE '   Folder participants can access both conversations AND messages';
    RAISE NOTICE '';
    RAISE NOTICE '✅ OWNERSHIP ENFORCEMENT:';
    RAISE NOTICE '   Users can only modify their own messages';
    RAISE NOTICE '   Service role has full access for operations';
    RAISE NOTICE '';
    RAISE NOTICE '✅ SPECIAL CASES HANDLED:';
    RAISE NOTICE '   Users can still access their own messages';
    RAISE NOTICE '   even if the conversation was deleted';
    RAISE NOTICE '';
    RAISE NOTICE 'This documentation ensures the secure policies';
    RAISE NOTICE 'are preserved and understood by the team.';
END $$;
