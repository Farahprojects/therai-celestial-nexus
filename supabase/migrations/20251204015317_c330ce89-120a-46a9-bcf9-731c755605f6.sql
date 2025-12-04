-- Phase 1: Update Journal RLS policies for folder participant access

-- Drop existing journal policies
DROP POLICY IF EXISTS "journal_select" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_insert" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_update" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_delete" ON public.journal_entries;

-- SELECT: Allow users to view their own journals OR journals in folders they participate in
CREATE POLICY "journal_select" ON public.journal_entries
FOR SELECT USING (
  (auth.uid() = user_id)
  OR 
  (folder_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.chat_folder_participants cfp
    WHERE cfp.folder_id = journal_entries.folder_id
    AND cfp.user_id = auth.uid()
  ))
  OR
  (folder_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = journal_entries.folder_id
    AND cf.user_id = auth.uid()
  ))
);

-- INSERT: Allow users to add journals to folders they own OR participate in
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
    )
  )
);

-- UPDATE: Only the journal author can update their entries
CREATE POLICY "journal_update" ON public.journal_entries
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Only the journal author can delete their entries
CREATE POLICY "journal_delete" ON public.journal_entries
FOR DELETE USING (auth.uid() = user_id);