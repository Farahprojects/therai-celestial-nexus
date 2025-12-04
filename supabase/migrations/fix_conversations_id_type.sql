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
  )
);

-- =================================================================
-- IMPORTANT: Messages RLS Policy History
-- =================================================================
-- This file previously contained an INSECURE messages policy:
-- CREATE POLICY "Allow access to valid chat messages" ON messages FOR ALL
-- TO anon, authenticated USING (chat_id IN (SELECT id FROM conversations))
--
-- This was VULNERABLE because it only checked conversation existence,
-- not user permissions or ownership.
--
-- The secure replacement policies are documented in:
-- 20250101000000_messages_rls_secure_policies.sql
--
-- Current secure policies: msg_select_participants, msg_insert_participants, etc.
-- =================================================================
