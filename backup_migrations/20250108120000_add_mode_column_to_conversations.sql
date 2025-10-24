-- Add mode column to conversations table
-- This will be the single source of truth for chat mode

ALTER TABLE "public"."conversations" 
ADD COLUMN "mode" text DEFAULT 'chat'::text;

-- Add check constraint to ensure valid mode values
ALTER TABLE "public"."conversations" 
ADD CONSTRAINT "conversations_mode_check" 
CHECK (("mode" = ANY (ARRAY['chat'::text, 'astro'::text, 'insight'::text])));

-- Update existing conversations to extract mode from meta if it exists
UPDATE "public"."conversations" 
SET "mode" = CASE 
  WHEN (meta->>'mode')::text = 'astro' THEN 'astro'
  WHEN (meta->>'mode')::text = 'insight' THEN 'insight'
  ELSE 'chat'
END
WHERE meta IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN "public"."conversations"."mode" IS 'Chat mode: chat, astro, or insight - single source of truth for conversation type';
