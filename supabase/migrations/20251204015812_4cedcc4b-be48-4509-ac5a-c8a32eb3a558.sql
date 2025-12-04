-- Phase 1: Add permission columns to chat_folder_participants
ALTER TABLE public.chat_folder_participants
ADD COLUMN IF NOT EXISTS can_view_journals boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS can_add_journals boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS can_view_documents boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_add_documents boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_view_conversations boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_view_insights boolean NOT NULL DEFAULT false;

-- Phase 2: Update RLS policies to check permissions

-- 2a. Update journal_entries policies
DROP POLICY IF EXISTS "journal_select" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_insert" ON public.journal_entries;

CREATE POLICY "journal_select" ON public.journal_entries
FOR SELECT USING (
  (auth.uid() = user_id)
  OR 
  (folder_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.chat_folder_participants cfp
    WHERE cfp.folder_id = journal_entries.folder_id
    AND cfp.user_id = auth.uid()
    AND cfp.can_view_journals = true
  ))
  OR
  (folder_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = journal_entries.folder_id
    AND cf.user_id = auth.uid()
  ))
);

CREATE POLICY "journal_insert" ON public.journal_entries
FOR INSERT WITH CHECK (
  (auth.uid() = user_id)
  AND (
    folder_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = journal_entries.folder_id
      AND cf.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.chat_folder_participants cfp
      WHERE cfp.folder_id = journal_entries.folder_id
      AND cfp.user_id = auth.uid()
      AND cfp.can_add_journals = true
    )
  )
);

-- 2b. Update folder_documents policies
DROP POLICY IF EXISTS "Users can view documents in their folders" ON public.folder_documents;

CREATE POLICY "Users can view documents in their folders" ON public.folder_documents
FOR SELECT USING (
  (auth.uid() = user_id)
  OR (EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = folder_documents.folder_id
    AND cf.user_id = auth.uid()
  ))
  OR (EXISTS (
    SELECT 1 FROM public.chat_folder_participants cfp
    WHERE cfp.folder_id = folder_documents.folder_id
    AND cfp.user_id = auth.uid()
    AND cfp.can_view_documents = true
  ))
);

DROP POLICY IF EXISTS "Users can insert documents into their folders" ON public.folder_documents;

CREATE POLICY "Users can insert documents into their folders" ON public.folder_documents
FOR INSERT WITH CHECK (
  (user_id = auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.chat_folder_participants cfp
      WHERE cfp.folder_id = folder_documents.folder_id
      AND cfp.user_id = auth.uid()
      AND cfp.can_add_documents = true
    )
  )
);

-- 2c. Update conversations policy for folder-based access
DROP POLICY IF EXISTS "convo_select_participants" ON public.conversations;

CREATE POLICY "convo_select_participants" ON public.conversations
FOR SELECT USING (
  (auth.uid() = user_id)
  OR (owner_user_id IS NOT NULL AND auth.uid() = owner_user_id)
  OR (EXISTS (
    SELECT 1 FROM public.conversations_participants cp
    WHERE cp.conversation_id = conversations.id
    AND cp.user_id = auth.uid()
  ))
  OR (is_public = true)
  OR (folder_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.chat_folder_participants cfp
    WHERE cfp.folder_id = conversations.folder_id
    AND cfp.user_id = auth.uid()
    AND cfp.can_view_conversations = true
  ))
);

-- 2d. Update insights policy
DROP POLICY IF EXISTS "insights_user_select" ON public.insights;

CREATE POLICY "insights_user_select" ON public.insights
FOR SELECT USING (
  (user_id = auth.uid())
  OR (EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = insights.folder_id
    AND cf.user_id = auth.uid()
  ))
  OR (folder_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.chat_folder_participants cfp
    WHERE cfp.folder_id = insights.folder_id
    AND cfp.user_id = auth.uid()
    AND cfp.can_view_insights = true
  ))
);