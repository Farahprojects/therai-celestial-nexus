-- Fix RLS policies for translator_logs to allow users to read their own logs
-- This is needed for Swiss data polling to work

-- Enable RLS if not already enabled
ALTER TABLE "public"."translator_logs" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can read their own translator logs" ON "public"."translator_logs";
DROP POLICY IF EXISTS "translator_logs_select_policy" ON "public"."translator_logs";

-- Create a policy that allows users to read translator_logs for their chat_id
-- We need to join with conversations table to check ownership
CREATE POLICY "Users can read their own translator logs"
ON "public"."translator_logs"
FOR SELECT
USING (
  -- Allow if the chat_id belongs to the user
  EXISTS (
    SELECT 1 FROM "public"."conversations"
    WHERE "conversations"."id" = "translator_logs"."chat_id"
    AND "conversations"."user_id" = auth.uid()
  )
);

-- Create a policy for service role to insert (for edge functions)
DROP POLICY IF EXISTS "Service role can insert translator logs" ON "public"."translator_logs";

CREATE POLICY "Service role can insert translator logs"
ON "public"."translator_logs"
FOR INSERT
WITH CHECK (true); -- Service role bypasses RLS anyway, but explicit is better

-- Add comment for documentation
COMMENT ON TABLE "public"."translator_logs" IS 'Logs from translator-edge function. Users can read their own logs via chat_id ownership.';

