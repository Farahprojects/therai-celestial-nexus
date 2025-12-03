-- SECURITY FIX: folder_documents DELETE policy consistency with UPDATE policy
-- Issue: DELETE policy was missing folder ownership verification
-- Fix: Update DELETE policy to match UPDATE policy security model

-- Update the existing DELETE policy to include folder ownership check
-- This ensures users can only delete documents they own in folders they own
ALTER POLICY "Users can delete their own documents" ON public.folder_documents
USING (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = (SELECT auth.uid())
  )
);

-- Verification query (run this manually to confirm)
-- SELECT 
--     cmd,
--     policyname,
--     CASE 
--         WHEN qual LIKE '%EXISTS%chat_folders%' THEN '✅ Includes folder ownership check'
--         ELSE '❌ Missing folder ownership check'
--     END as security_level
-- FROM pg_policies 
-- WHERE tablename = 'folder_documents'
--   AND cmd IN ('UPDATE', 'DELETE')
-- ORDER BY cmd;
