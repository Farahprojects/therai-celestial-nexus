-- Create generated-images storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('generated-images', 'generated-images', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can only insert their own images (CORRECTED: use string_to_array)
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-images' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- RLS: Users can only view their own images
CREATE POLICY "Users can view their own images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-images' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- RLS: Users can delete their own images
CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-images' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- CRITICAL: Service role policy for edge function uploads
CREATE POLICY "Service role full access on generated images"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'generated-images')
WITH CHECK (bucket_id = 'generated-images');

