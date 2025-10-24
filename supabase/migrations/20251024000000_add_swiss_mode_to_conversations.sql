-- Add 'swiss' to the allowed mode values for conversations table
-- This updates the existing check constraint to include the new swiss mode

-- Drop the existing constraint
ALTER TABLE "public"."conversations" 
DROP CONSTRAINT IF EXISTS "conversations_mode_check";

-- Add the updated constraint with 'swiss' included
ALTER TABLE "public"."conversations" 
ADD CONSTRAINT "conversations_mode_check" 
CHECK (("mode" = ANY (ARRAY['chat'::text, 'astro'::text, 'insight'::text, 'swiss'::text])));

-- Update comment for documentation
COMMENT ON COLUMN "public"."conversations"."mode" IS 'Chat mode: chat, astro, insight, or swiss - single source of truth for conversation type';

