-- Allow users to view their own messages (especially images) even if the conversation was deleted
-- This ensures images remain visible on the images page after chat deletion

DROP POLICY IF EXISTS "users_can_view_own_messages_after_chat_deletion" ON public.messages;
CREATE POLICY "users_can_view_own_messages_after_chat_deletion"
ON public.messages
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);
-- This policy is permissive (OR logic), so it works alongside existing conversation-based policies
-- Users can see messages from:
-- 1. Their own conversations (existing policy)
-- 2. Their own messages even if conversation deleted (new policy);
