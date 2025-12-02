-- Fix UNION type mismatch by changing conversations.id to TEXT
-- This allows translator_logs RLS policy to work properly

-- First, check current column type
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversations' AND column_name = 'id';

-- Change conversations.id from UUID to TEXT
ALTER TABLE conversations ALTER COLUMN id TYPE TEXT;

-- Update the RLS policy for translator_logs (now both sides are TEXT)
DROP POLICY IF EXISTS "Allow access to valid translator logs" ON translator_logs;

CREATE POLICY "Allow access to valid translator logs"
ON public.translator_logs
FOR ALL
TO anon, authenticated
USING (
  user_id IN (
    SELECT id FROM public.conversations
    UNION
    SELECT chat_id FROM public.guest_reports
  )
);

-- Also update the messages RLS policy to match
DROP POLICY IF EXISTS "Allow access to valid chat messages" ON messages;

CREATE POLICY "Allow access to valid chat messages"
ON public.messages
FOR ALL
TO anon, authenticated
USING (
  chat_id IN (
    SELECT id FROM public.conversations
    UNION
    SELECT chat_id FROM public.guest_reports
  )
);
