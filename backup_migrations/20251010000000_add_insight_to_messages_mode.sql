-- Remove mode constraint from messages table
-- The conversations.mode is the source of truth
-- Messages should accept any mode value without validation

-- Drop the constraint - we don't need to validate mode at the message level
ALTER TABLE "public"."messages" 
DROP CONSTRAINT IF EXISTS "messages_mode_check";

