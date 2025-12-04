-- Additional fixes for folder-documents security and policies
-- These fixes address file size limits and policy corrections

-- Set file size limit (50MB)
UPDATE storage.buckets
SET file_size_limit = 52428800  -- 50MB
WHERE id = 'folder-documents';

-- Fix INSERT policy to use authenticated role only
DROP POLICY IF EXISTS "Users can insert documents into their folders" ON public.folder_documents;
CREATE POLICY "Users can insert documents into their folders" ON public.folder_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_folders cf
      WHERE cf.id = folder_id AND cf.user_id = auth.uid()
    )
  );

-- Fix Storage VIEW policy bug
DROP POLICY IF EXISTS "Users can view folder documents" ON storage.objects;
CREATE POLICY "Users can view folder documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'folder-documents'
    AND (
      (string_to_array(name, '/'))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM chat_folders
        WHERE chat_folders.id::text = (string_to_array(name, '/'))[2]
        AND chat_folders.user_id = auth.uid()
      )
    )
  );
