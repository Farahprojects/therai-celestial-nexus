-- Remove default value from mode column
-- Mode must be explicitly set when creating conversations - no defaults allowed

ALTER TABLE "public"."conversations" 
ALTER COLUMN "mode" DROP DEFAULT;

-- Update comment for documentation
COMMENT ON COLUMN "public"."conversations"."mode" IS 'Chat mode: chat, astro, or insight - must be explicitly set on creation, no defaults';

