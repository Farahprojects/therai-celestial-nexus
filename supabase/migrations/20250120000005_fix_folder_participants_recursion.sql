-- Fix infinite recursion in folder participants RLS policy
-- The issue was that chat_folder_participants policy was querying itself
-- Solution: Use simple policy like conversations_participants (USING (true))

-- Drop and recreate the participants view policy (non-recursive)
DROP POLICY IF EXISTS "Users can view folder participants" ON public.chat_folder_participants;

CREATE POLICY "Users can view folder participants"
ON public.chat_folder_participants
FOR SELECT
TO authenticated
USING (true);

