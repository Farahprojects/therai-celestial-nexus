-- Create folder-documents storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('folder-documents', 'folder-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can only upload their own documents
-- File path structure: {userId}/{folderId}/{timestamp}_{filename}
-- First path segment must match the authenticated user's ID
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload folder documents'
  ) THEN
    CREATE POLICY "Users can upload folder documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'folder-documents' AND
      (string_to_array(name, '/'))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- RLS: Users can view documents they uploaded OR documents in folders they own
-- File path structure: {userId}/{folderId}/{timestamp}_{filename}
-- Users can view if:
--   1. They uploaded it (first path segment = their user_id), OR
--   2. They own the folder (second path segment = folder_id they own)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view folder documents'
  ) THEN
    CREATE POLICY "Users can view folder documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'folder-documents' AND (
        -- User uploaded the file
        (string_to_array(name, '/'))[1] = auth.uid()::text
        OR
        -- User owns the folder (second path segment is folder_id)
        EXISTS (
          SELECT 1 FROM public.chat_folders
          WHERE id::text = (string_to_array(name, '/'))[2]
          AND user_id = auth.uid()
        )
      )
    );
  END IF;
END $$;

-- RLS: Users can delete documents they uploaded
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete folder documents'
  ) THEN
    CREATE POLICY "Users can delete folder documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'folder-documents' AND
      (string_to_array(name, '/'))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Service role policy for edge function uploads (if needed in the future)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Service role full access on folder documents'
  ) THEN
    CREATE POLICY "Service role full access on folder documents"
    ON storage.objects FOR ALL
    TO service_role
    USING (bucket_id = 'folder-documents')
    WITH CHECK (bucket_id = 'folder-documents');
  END IF;
END $$;

