-- User Attribution Schema Changes
-- Reference file for all SQL commands run to add user_id and user_name to messages table

-- 1. Add user_id column to messages table (renamed from sender_user_id)
ALTER TABLE messages RENAME COLUMN sender_user_id TO user_id;

-- 2. Add user_name column to messages table  
ALTER TABLE messages ADD COLUMN user_name text;

-- Summary:
-- - user_id: UUID column for user identification (renamed from sender_user_id)
-- - user_name: Text column for user display name (extracted from email prefix)
-- 
-- Both columns are now populated by all edge functions (chat-send, google-whisper, llm-handler-gemini)
-- and frontend calls for proper message attribution in shared conversations.
