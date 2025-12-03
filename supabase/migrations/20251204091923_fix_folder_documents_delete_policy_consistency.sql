-- SECURITY FIX: Make folder_documents DELETE policy consistent with UPDATE policy
-- Issue: DELETE policy only checks document ownership, missing folder ownership verification
-- Fix: Update DELETE policy to require both document ownership AND folder ownership

-- Drop the incomplete DELETE policy
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.folder_documents;

-- Create the proper DELETE policy matching UPDATE policy security model
-- Users can only delete documents they own AND that are in folders they own
CREATE POLICY "Users can delete their own documents" ON public.folder_documents
FOR DELETE TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = (SELECT auth.uid())
  )
);

-- Verify the policy was created correctly
DO $$
DECLARE
    delete_policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO delete_policy_count
    FROM pg_policies 
    WHERE tablename = 'folder_documents'
      AND cmd = 'DELETE'
      AND policyname = 'Users can delete their own documents';
    
    IF delete_policy_count > 0 THEN
        RAISE NOTICE '✅ DELETE policy updated successfully with folder ownership check';
    ELSE
        RAISE EXCEPTION '❌ DELETE policy update failed';
    END IF;
END $$;
