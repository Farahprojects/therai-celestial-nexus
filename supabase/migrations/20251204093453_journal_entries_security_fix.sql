-- JOURNAL ENTRIES SECURITY FIX
-- Align with folder_documents security model: double-verification (user + folder ownership)

-- 1. Check current policies
SELECT 
    cmd,
    policyname,
    roles,
    CASE 
        WHEN qual LIKE '%folder_id%' AND qual LIKE '%chat_folders%' THEN '✅ Has folder ownership check'
        WHEN qual LIKE '%client_id%' OR qual LIKE '%user_id%' THEN '⚠️ User ownership only'
        ELSE '❓ Unknown'
    END as security_level,
    LEFT(qual, 60) || CASE WHEN LENGTH(qual) > 60 THEN '...' ELSE '' END as using_clause
FROM pg_policies 
WHERE tablename = 'journal_entries'
ORDER BY cmd;

-- 2. Update DELETE policy to include folder ownership check (like folder_documents)
-- Current: (( SELECT auth.uid() AS uid) = user_id)
-- Should be: user owns entry AND (entry has no folder OR user owns the folder)
ALTER POLICY "journal_delete" ON public.journal_entries
USING (
  (SELECT auth.uid()) = client_id  -- Fix: use client_id (matches service code)
  AND (
    folder_id IS NULL  -- Entry not in any folder (personal entry)
    OR EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = journal_entries.folder_id
        AND cf.user_id = (SELECT auth.uid())
    )  -- Entry is in a folder owned by the user
  )
);

-- 3. Check if other policies need folder ownership checks
-- SELECT and UPDATE should probably also check folder ownership
SELECT 
    'RECOMMENDED FIXES' as recommendation,
    cmd,
    policyname,
    CASE 
        WHEN cmd IN ('SELECT', 'UPDATE') AND qual NOT LIKE '%chat_folders%' THEN 
            '⚠️ Should add folder ownership check like DELETE policy'
        ELSE '✅ Policy looks secure'
    END as status
FROM pg_policies 
WHERE tablename = 'journal_entries'
  AND cmd IN ('SELECT', 'UPDATE', 'DELETE')
ORDER BY cmd;
