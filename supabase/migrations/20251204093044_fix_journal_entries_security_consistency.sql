-- SECURITY FIX: journal_entries policies consistency with folder_documents
-- Issue: DELETE policy only checked user ownership, missing folder ownership verification
-- Fix: Update DELETE policy to check both user ownership AND folder ownership

-- Update the DELETE policy to include folder ownership check
-- This ensures users can only delete journal entries they own AND that are in folders they own
-- OR entries that are not associated with any folder (personal entries)
ALTER POLICY "journal_delete" ON public.journal_entries
USING (
  (SELECT auth.uid()) = client_id  -- Use client_id (matches service code)
  AND (
    folder_id IS NULL  -- Personal entry not in any folder
    OR EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = journal_entries.folder_id
        AND cf.user_id = (SELECT auth.uid())
    )  -- Entry is in a folder owned by the user
  )
);

-- Verification query (run this manually to confirm)
-- SELECT
--     cmd,
--     policyname,
--     CASE
--         WHEN qual LIKE '%EXISTS%chat_folders%' THEN '✅ Includes folder ownership check'
--         WHEN qual LIKE '%client_id%' THEN '✅ Uses correct user field (client_id)'
--         ELSE '❌ Missing security checks'
--     END as security_status
-- FROM pg_policies
-- WHERE tablename = 'journal_entries'
--   AND cmd = 'DELETE';
