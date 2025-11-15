-- Fix public folder access issue
-- This migration ensures the RLS policy only checks is_public = true for public access

-- Drop the old policy to ensure it doesn't have any incorrect checks
DROP POLICY IF EXISTS "Public can view public folders" ON public.chat_folders;
-- Create the correct policy that only checks is_public (should match 20250131000002)
CREATE POLICY "Public can view public folders"
ON public.chat_folders
FOR SELECT
TO public
USING (is_public = true);
-- Also ensure authenticated users can view public folders (not just their own)
DROP POLICY IF EXISTS "Users can view folders" ON public.chat_folders;
CREATE POLICY "Users can view folders"
ON public.chat_folders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()  -- Owner
  OR is_public = true   -- Public folder
);
-- Also ensure conversations RLS policy allows public access to conversations in public folders
DROP POLICY IF EXISTS "public_sel" ON public.conversations;
CREATE POLICY "public_sel"
ON public.conversations
AS PERMISSIVE
FOR SELECT
TO public
USING (
  is_public = true  -- Public conversation
  OR EXISTS (       -- In public folder
    SELECT 1 FROM public.chat_folders
    WHERE id = conversations.folder_id
    AND is_public = true
  )
);
