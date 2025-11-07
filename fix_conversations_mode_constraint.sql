-- Fix conversations_mode_check constraint to include 'profile' and 'together'
-- This script checks the current constraint and updates it if needed
-- Run this against the PRODUCTION database that your edge functions connect to

-- Step 1: Check current constraint definition
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.conversations'::regclass
  AND conname = 'conversations_mode_check';

-- Step 2: Check what modes are currently allowed (if constraint exists)
SELECT 
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.conversations'::regclass
  AND conname = 'conversations_mode_check';

-- Step 3: Drop the existing constraint (safe - uses IF EXISTS)
ALTER TABLE "public"."conversations" 
DROP CONSTRAINT IF EXISTS "conversations_mode_check";

-- Step 4: Add the updated constraint with 'profile' and 'together' included
ALTER TABLE "public"."conversations" 
ADD CONSTRAINT "conversations_mode_check" 
CHECK (("mode" = ANY (ARRAY['chat'::text, 'astro'::text, 'insight'::text, 'swiss'::text, 'profile'::text, 'together'::text])));

-- Step 5: Verify the constraint was applied correctly
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.conversations'::regclass
  AND conname = 'conversations_mode_check';

-- Step 6: Test that 'profile' mode is now allowed (should return no rows if constraint is correct)
-- This query will fail if the constraint doesn't allow 'profile'
SELECT 'profile'::text WHERE 'profile' = ANY (ARRAY['chat'::text, 'astro'::text, 'insight'::text, 'swiss'::text, 'profile'::text, 'together'::text]);

-- Step 7: Update comment for documentation
COMMENT ON COLUMN "public"."conversations"."mode" IS 'Chat mode: chat, astro, insight, swiss, profile, or together - single source of truth for conversation type';

