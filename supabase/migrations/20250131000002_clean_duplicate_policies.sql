-- Clean up duplicate and old policies, then create only the correct ones
-- This fixes the infinite recursion issue caused by old policies

-- ============================================================================
-- STEP 1: Drop ALL existing policies on both tables (clean slate)
-- ============================================================================

-- Drop ALL chat_folder_participants policies
DROP POLICY IF EXISTS "Owners can manage participants" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Owners can update participants" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Owners can delete participants" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Users can join folders" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Users can leave folders" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Users can leave folders or owners remove" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Users can update own participant" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Users can view folder participants" ON public.chat_folder_participants;
-- Drop ALL chat_folders policies
DROP POLICY IF EXISTS "Public can view public folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Public can view shared folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Users can create their own folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Users can manage own folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Users can manage their own folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Users can view folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Users can view their own folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Owners can update folder sharing" ON public.chat_folders;
-- ============================================================================
-- STEP 2: Create ONLY the correct, non-recursive policies
-- ============================================================================

-- CHAT_FOLDERS: Simple, self-contained policies (NO recursion)
-- ============================================================================

-- Authenticated users can view folders they own or public folders
CREATE POLICY "Users can view folders"
ON public.chat_folders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()  -- Owner
  OR is_public = true   -- Public folder
  -- NO participant check - breaks recursion
);
-- Unauthenticated users can view public folders
CREATE POLICY "Public can view public folders"
ON public.chat_folders
FOR SELECT
TO public
USING (is_public = true);
-- Users can manage (INSERT/UPDATE/DELETE) their own folders
CREATE POLICY "Users can manage own folders"
ON public.chat_folders
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
-- CHAT_FOLDER_PARTICIPANTS: Simple, self-contained policies (NO recursion)
-- ============================================================================

-- Users can only see their own participant records
CREATE POLICY "Users can view folder participants"
ON public.chat_folder_participants
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
-- Only see your own participation

-- Users can join folders (insert themselves)
CREATE POLICY "Users can join folders"
ON public.chat_folder_participants
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
-- Users can only leave folders (delete their own participation)
CREATE POLICY "Users can leave folders"
ON public.chat_folder_participants
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
-- Only delete your own participation

-- Users can only update their own participant records
CREATE POLICY "Users can update own participant"
ON public.chat_folder_participants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
-- ============================================================================
-- VERIFICATION: Check policies are correct
-- ============================================================================
-- Run this query to verify:
-- SELECT policyname, schemaname, tablename 
-- FROM pg_policies 
-- WHERE tablename IN ('chat_folders', 'chat_folder_participants')
-- ORDER BY tablename, policyname;
--
-- Expected result for chat_folders (3 policies):
-- 1. "Public can view public folders"
-- 2. "Users can manage own folders"
-- 3. "Users can view folders"
--
-- Expected result for chat_folder_participants (4 policies):
-- 1. "Users can join folders"
-- 2. "Users can leave folders"
-- 3. "Users can update own participant"
-- 4. "Users can view folder participants"
-- ============================================================================;
