-- Comprehensive fix for conversations_mode_check constraint issue

-- Step 1: Check current constraint definition
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition,
  convalidated AS is_validated
FROM pg_constraint
WHERE conrelid = 'public.conversations'::regclass
  AND conname = 'conversations_mode_check';

-- Step 2: Check if there are any existing rows with invalid mode values
SELECT mode, COUNT(*) as count
FROM public.conversations
GROUP BY mode
ORDER BY count DESC;

-- Step 3: Drop ALL mode-related constraints (in case there are duplicates or not validated ones)
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_mode_check CASCADE;

-- Step 4: Re-create the constraint with all valid modes
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_mode_check
  CHECK (mode = ANY (ARRAY['chat'::text, 'astro'::text, 'insight'::text, 'swiss'::text, 'profile'::text, 'together'::text]));

-- Step 5: Validate the constraint is working
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition,
  convalidated AS is_validated
FROM pg_constraint
WHERE conrelid = 'public.conversations'::regclass
  AND conname = 'conversations_mode_check';

-- Step 6: Test insert with profile mode (this should succeed)
DO $$
DECLARE
  test_id uuid := gen_random_uuid();
  test_user_id uuid;
BEGIN
  -- Get a real user_id from the database
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    -- Try to insert a test row with mode='profile'
    INSERT INTO public.conversations (id, user_id, owner_user_id, title, mode)
    VALUES (test_id, test_user_id, test_user_id, 'Test Profile', 'profile');
    
    -- If successful, delete the test row
    DELETE FROM public.conversations WHERE id = test_id;
    
    RAISE NOTICE 'SUCCESS: profile mode insert works correctly';
  ELSE
    RAISE NOTICE 'SKIPPED: No users found to test with';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: profile mode insert failed - %', SQLERRM;
END $$;

