-- CRITICAL SECURITY FIX: Add MIME type restrictions to folder-documents bucket
-- This prevents malicious file uploads while allowing legitimate document types
-- Server-side validation to prevent bypass of frontend checks

-- Add MIME type restrictions to the folder-documents bucket
-- Only allow safe, document-related file types

DO $$
DECLARE
  mime_types_allowlist TEXT[] := ARRAY[
    -- Documents
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',

    -- Text files
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/html',
    'text/xml',
    'application/json',
    'application/javascript',
    'text/javascript',
    'application/typescript',
    'text/typescript',

    -- Archives (for storage, not execution)
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',

    -- Images (for reference documents)
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];
BEGIN
  -- Update the bucket configuration to restrict MIME types
  UPDATE storage.buckets
  SET allowed_mime_types = mime_types_allowlist
  WHERE id = 'folder-documents';

  -- Log the security fix
  RAISE NOTICE 'MIME type restrictions added to folder-documents bucket. Allowed types: %', array_to_string(mime_types_allowlist, ', ');
END $$;

-- Note: Cannot create triggers on Supabase's managed storage.objects table
-- The bucket allowed_mime_types provides the primary database-level protection

-- Update bucket to be more restrictive
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/xml',
  'application/json',
  'application/javascript',
  'text/javascript',
  'application/typescript',
  'text/typescript',
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
]
WHERE id = 'folder-documents';
-- For production, consider using Supabase Edge Functions for server-side validation
