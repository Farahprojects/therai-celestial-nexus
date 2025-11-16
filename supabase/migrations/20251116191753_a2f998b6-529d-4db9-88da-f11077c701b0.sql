-- Clean up orphaned records and add CASCADE DELETE for report_logs and translator_logs

-- Step 1: Delete orphaned records from report_logs (records where chat_id doesn't exist in conversations)
DELETE FROM public.report_logs 
WHERE chat_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE conversations.id = report_logs.chat_id
  );

-- Step 2: Delete orphaned records from translator_logs (records where chat_id doesn't exist in conversations)
DELETE FROM public.translator_logs 
WHERE chat_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE conversations.id = translator_logs.chat_id
  );

-- Step 3: Add CASCADE DELETE to report_logs.chat_id foreign key
ALTER TABLE public.report_logs 
  DROP CONSTRAINT IF EXISTS report_logs_chat_id_fkey;

ALTER TABLE public.report_logs 
  ADD CONSTRAINT report_logs_chat_id_fkey 
  FOREIGN KEY (chat_id) 
  REFERENCES public.conversations(id) 
  ON DELETE CASCADE;

-- Step 4: Add CASCADE DELETE to translator_logs.chat_id foreign key
ALTER TABLE public.translator_logs 
  DROP CONSTRAINT IF EXISTS translator_logs_chat_id_fkey;

ALTER TABLE public.translator_logs 
  ADD CONSTRAINT translator_logs_chat_id_fkey 
  FOREIGN KEY (chat_id) 
  REFERENCES public.conversations(id) 
  ON DELETE CASCADE;

-- Verification: Check for any remaining orphaned records (should return 0 for both)
DO $$
DECLARE
  orphaned_report_logs INT;
  orphaned_translator_logs INT;
BEGIN
  SELECT COUNT(*) INTO orphaned_report_logs
  FROM public.report_logs 
  WHERE chat_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM public.conversations WHERE conversations.id = report_logs.chat_id);
    
  SELECT COUNT(*) INTO orphaned_translator_logs
  FROM public.translator_logs 
  WHERE chat_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM public.conversations WHERE conversations.id = translator_logs.chat_id);
    
  RAISE NOTICE 'Orphaned report_logs: %', orphaned_report_logs;
  RAISE NOTICE 'Orphaned translator_logs: %', orphaned_translator_logs;
  
  IF orphaned_report_logs > 0 OR orphaned_translator_logs > 0 THEN
    RAISE WARNING 'Still have orphaned records after cleanup!';
  ELSE
    RAISE NOTICE 'All orphaned records cleaned up successfully!';
  END IF;
END $$;