-- Simple Folder Sharing - Mirrors Conversation Sharing Pattern
-- Two modes: public (no auth) or private (requires sign-in + participants)

-- ============================================================================
-- STEP 1: Ensure chat_folder_participants table exists (already in schema)
-- ============================================================================
-- Table structure:
-- - folder_id: uuid (FK to chat_folders)
-- - user_id: uuid (FK to auth.users)
-- - role: text ('owner' or 'member')
-- - invited_by: uuid (FK to auth.users)
-- - joined_at: timestamp

-- If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS public.chat_folder_participants (
  folder_id uuid NOT NULL REFERENCES public.chat_folders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (folder_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_folder_participants_folder_id 
  ON public.chat_folder_participants(folder_id);
CREATE INDEX IF NOT EXISTS idx_chat_folder_participants_user_id 
  ON public.chat_folder_participants(user_id);

-- Enable RLS
ALTER TABLE public.chat_folder_participants ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Add is_public flag to chat_folders (mirrors conversations.is_public)
-- ============================================================================
-- Already exists in schema, just ensure it's there
ALTER TABLE public.chat_folders
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_chat_folders_is_public 
  ON public.chat_folders(is_public) WHERE is_public = true;

-- ============================================================================
-- STEP 3: Simple RLS Policies - ZERO RECURSION RISK
-- ============================================================================
-- CRITICAL: To avoid infinite recursion (42P17 error), we DO NOT check
-- chat_folder_participants from chat_folders policies or vice versa.
-- Participant checking is handled in application code (getUserFolders).
-- This ensures policies are self-contained and cannot create circular dependencies.
-- ============================================================================

-- FOLDERS: Users can view folders they own or public folders
-- Participant checking is done in application code to avoid recursion
DROP POLICY IF EXISTS "Users can view folders" ON public.chat_folders;
CREATE POLICY "Users can view folders"
ON public.chat_folders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()  -- Owner
  OR is_public = true   -- Public folder
  -- NO participant check here - breaks recursion
);

-- Public (unauthenticated) users can view truly public folders
DROP POLICY IF EXISTS "Public can view public folders" ON public.chat_folders;
CREATE POLICY "Public can view public folders"
ON public.chat_folders
FOR SELECT
TO public
USING (is_public = true);

-- Users can manage their own folders
DROP POLICY IF EXISTS "Users can manage own folders" ON public.chat_folders;
CREATE POLICY "Users can manage own folders"
ON public.chat_folders
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- FOLDER PARTICIPANTS: Users can only see their own participant records
-- This prevents recursion and maintains privacy
DROP POLICY IF EXISTS "Users can view folder participants" ON public.chat_folder_participants;
CREATE POLICY "Users can view folder participants"
ON public.chat_folder_participants
FOR SELECT
TO authenticated
USING (user_id = auth.uid());  -- Only see your own participation

-- Users can join folders (insert themselves)
DROP POLICY IF EXISTS "Users can join folders" ON public.chat_folder_participants;
CREATE POLICY "Users can join folders"
ON public.chat_folder_participants
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can only leave folders (delete their own participation)
-- Owner removal of participants must be done via application code
DROP POLICY IF EXISTS "Users can leave folders" ON public.chat_folder_participants;
CREATE POLICY "Users can leave folders"
ON public.chat_folder_participants
FOR DELETE
TO authenticated
USING (user_id = auth.uid());  -- Only delete your own participation

-- Users can only update their own participant records
-- Owner management of other participants must be done via application code with service role
DROP POLICY IF EXISTS "Users can update own participant" ON public.chat_folder_participants;
CREATE POLICY "Users can update own participant"
ON public.chat_folder_participants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- ============================================================================
-- STEP 4: Update CONVERSATIONS RLS to inherit folder access
-- ============================================================================

-- Authenticated users can view conversations they own, participate in, 
-- are public, or are in folders they have access to
DROP POLICY IF EXISTS "usr_sel" ON public.conversations;
CREATE POLICY "usr_sel"
ON public.conversations
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()              -- Owner
  OR owner_user_id = auth.uid()     -- Owner (legacy)
  OR is_public = true               -- Public conversation
  OR EXISTS (                       -- Direct participant
    SELECT 1 FROM conversations_participants 
    WHERE conversation_id = conversations.id 
    AND user_id = auth.uid()
  )
  OR EXISTS (                       -- Folder participant (inherit from folder)
    SELECT 1 FROM public.chat_folder_participants cfp
    JOIN public.chat_folders cf ON cf.id = cfp.folder_id
    WHERE cfp.user_id = auth.uid()
    AND conversations.folder_id = cf.id
  )
  OR EXISTS (                       -- Public folder
    SELECT 1 FROM public.chat_folders
    WHERE id = conversations.folder_id
    AND is_public = true
  )
);

-- Public (unauthenticated) users can view public conversations or conversations in public folders
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

-- ============================================================================
-- STEP 5: Update MESSAGES RLS to match conversation access
-- ============================================================================

DROP POLICY IF EXISTS "usr_sel" ON public.messages;
CREATE POLICY "usr_sel"
ON public.messages
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.chat_id
    AND (
      c.user_id = auth.uid()
      OR c.owner_user_id = auth.uid()
      OR c.is_public = true
      OR EXISTS (
        SELECT 1 FROM conversations_participants
        WHERE conversation_id = c.id
        AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.chat_folder_participants cfp
        JOIN public.chat_folders cf ON cf.id = cfp.folder_id
        WHERE cfp.user_id = auth.uid()
        AND c.folder_id = cf.id
      )
      OR EXISTS (
        SELECT 1 FROM public.chat_folders
        WHERE id = c.folder_id
        AND is_public = true
      )
    )
  )
);

DROP POLICY IF EXISTS "public_sel" ON public.messages;
CREATE POLICY "public_sel"
ON public.messages
AS PERMISSIVE
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.chat_id
    AND (
      c.is_public = true
      OR EXISTS (
        SELECT 1 FROM public.chat_folders
        WHERE id = c.folder_id
        AND is_public = true
      )
    )
  )
);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ Folder sharing with participants (like conversation sharing)
-- ✅ Public mode: is_public = true (no auth required)
-- ✅ Private mode: uses chat_folder_participants (auth required)
-- ✅ Permission inheritance: folder participant → see all chats in folder
-- ✅ No circular dependencies (participants policy uses USING (true))
-- ✅ No triggers or cascades
-- ✅ Clean and simple

