-- Create generated-images storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('generated-images', 'generated-images', false)
ON CONFLICT (id) DO NOTHING;
-- RLS: Users can only insert their own images (CORRECTED: use string_to_array)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload their own images'
  ) THEN
    CREATE POLICY "Users can upload their own images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'generated-images' AND
      (string_to_array(name, '/'))[1] = auth.uid()::text
    );
  END IF;
END $$;
-- RLS: Users can only view their own images
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view their own images'
  ) THEN
    CREATE POLICY "Users can view their own images"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'generated-images' AND
      (string_to_array(name, '/'))[1] = auth.uid()::text
    );
  END IF;
END $$;
-- RLS: Users can delete their own images
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete their own images'
  ) THEN
    CREATE POLICY "Users can delete their own images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'generated-images' AND
      (string_to_array(name, '/'))[1] = auth.uid()::text
    );
  END IF;
END $$;
-- CRITICAL: Service role policy for edge function uploads
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Service role full access on generated images'
  ) THEN
    CREATE POLICY "Service role full access on generated images"
    ON storage.objects FOR ALL
    TO service_role
    USING (bucket_id = 'generated-images')
    WITH CHECK (bucket_id = 'generated-images');
  END IF;
END $$;
