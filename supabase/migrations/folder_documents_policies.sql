-- FOLDER_DOCUMENTS CONSOLIDATED POLICIES
-- Reference implementation for folder-based document access
-- Strict ownership verification for document modifications

-- Double-verification policy for document updates
-- Users can only update documents they own AND that are in folders they own
CREATE POLICY folder_documents_user_update ON public.folder_documents
FOR UPDATE TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = (SELECT auth.uid())
  )
);

-- Double-verification policy for document deletion
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
