-- RADICAL SIMPLIFICATION: Remove all folder sharing complexity
-- Goal: Make sharing work exactly like signed-in users (just check is_public flag)
-- Remove: folder participants, share modes, complex triggers, recursive RLS

-- ============================================================================
-- STEP 1: Drop all triggers and functions for folder sharing
-- ============================================================================

DROP TRIGGER IF EXISTS trg_share_folder_conversations ON public.chat_folders;
DROP TRIGGER IF EXISTS trg_conversation_folder_share ON public.conversations;
DROP TRIGGER IF EXISTS trg_handle_shared_folder ON public.chat_folders;

DROP FUNCTION IF EXISTS public.handle_share_folder_conversations();
DROP FUNCTION IF EXISTS public.handle_conversation_added_to_shared_folder();
DROP FUNCTION IF EXISTS public.handle_shared_folder_participant();

-- ============================================================================
-- STEP 2: Drop ALL policies that reference share_mode FIRST
-- ============================================================================

-- Drop folder policies that reference share_mode
DROP POLICY IF EXISTS "Public can view shared folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Public can view public folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Users can view their own folders" ON public.chat_folders;
DROP POLICY IF EXISTS "Owners can update folder sharing" ON public.chat_folders;

-- Drop conversation policies that reference share_mode (via folder join)
DROP POLICY IF EXISTS "usr_sel" ON public.conversations;
DROP POLICY IF EXISTS "public_sel" ON public.conversations;

-- Drop message policies that might reference share_mode
DROP POLICY IF EXISTS "usr_sel" ON public.messages;
DROP POLICY IF EXISTS "public_sel" ON public.messages;

-- ============================================================================
-- STEP 3: Drop folder participant policies and table
-- ============================================================================

-- Drop all policies on chat_folder_participants
DROP POLICY IF EXISTS "Users can view folder participants" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Users can manage their own participant records" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Owners can manage folder participants" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Users can join folders" ON public.chat_folder_participants;
DROP POLICY IF EXISTS "Users can leave folders" ON public.chat_folder_participants;

-- Drop the table entirely (it's only for folder sharing complexity)
DROP TABLE IF EXISTS public.chat_folder_participants CASCADE;

-- ============================================================================
-- STEP 4: Remove share_mode column and index
-- ============================================================================

-- Drop the index first
DROP INDEX IF EXISTS public.idx_chat_folders_share_mode;

-- Remove share_mode column (no policies reference it anymore)
ALTER TABLE public.chat_folders
DROP COLUMN IF EXISTS share_mode;

-- ============================================================================
-- STEP 5: Create simplified chat_folders RLS policies
-- ============================================================================

-- Create simple policies for folders (no participants, no complexity)
CREATE POLICY "Users can view their own folders"
ON public.chat_folders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own folders"
ON public.chat_folders
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: Folders themselves don't need public sharing - only conversations do
-- This removes the entire concept of "shared folders" - just share individual conversations

-- ============================================================================
-- STEP 6: Create simplified conversations RLS policies
-- ============================================================================

-- Simple policy for authenticated users
CREATE POLICY "usr_sel"
ON public.conversations
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()              -- Owner (main column)
  OR owner_user_id = auth.uid()     -- Owner (legacy column)
  OR is_public = true               -- Public conversations (shared)
  OR EXISTS (                       -- Direct participant in conversation
    SELECT 1 FROM conversations_participants 
    WHERE conversation_id = id AND user_id = auth.uid()
    LIMIT 1
  )
);

-- Simple policy for unauthenticated users (public access)
CREATE POLICY "public_sel"
ON public.conversations
AS PERMISSIVE
FOR SELECT
TO public  -- unauthenticated users
USING (
  is_public = true  -- Only public conversations visible without auth
);

-- ============================================================================
-- STEP 7: Create simplified messages RLS policies
-- ============================================================================

-- Simple policy for authenticated users to view messages
CREATE POLICY "usr_sel"
ON public.messages
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.chat_id
    AND (
      conversations.user_id = auth.uid()
      OR conversations.owner_user_id = auth.uid()
      OR conversations.is_public = true
      OR EXISTS (
        SELECT 1 FROM conversations_participants
        WHERE conversation_id = conversations.id
        AND user_id = auth.uid()
        LIMIT 1
      )
    )
  )
);

-- Simple policy for unauthenticated users to view messages in public conversations
CREATE POLICY "public_sel"
ON public.messages
AS PERMISSIVE
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.chat_id
    AND conversations.is_public = true
  )
);

-- ============================================================================
-- SUMMARY: What we removed
-- ============================================================================
-- ✅ chat_folder_participants table (folder sharing complexity)
-- ✅ share_mode column (private vs public modes)
-- ✅ Complex triggers that auto-sync folder/conversation sharing
-- ✅ Circular RLS dependencies between folders and participants
-- ✅ EXISTS clauses checking folder participants
-- ✅ SECURITY DEFINER functions to work around recursion
--
-- What remains:
-- ✅ conversations.is_public (simple boolean flag)
-- ✅ conversations_participants (direct conversation sharing)
-- ✅ Simple RLS: is_public = true OR user owns/participates
-- ✅ Works same for authenticated and unauthenticated users

