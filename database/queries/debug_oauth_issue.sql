-- Debug OAuth 302 Error - Check Database State
-- Run these queries in Supabase SQL Editor to diagnose the issue

-- 1. Check if user_preferences table exists and its structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences'
ORDER BY ordinal_position;

-- 2. Check RLS policies on user_preferences
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_preferences';

-- 3. Check if handle_new_user function exists
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 4. Check if the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 5. Test the trigger manually (this will help identify the exact failure)
-- Replace 'test-user-id' with an actual UUID to test
SELECT public.handle_new_user() FROM (
  SELECT 
    'test-user-id'::uuid as id,
    'test@example.com' as email,
    now() as email_confirmed_at,
    now() as created_at
) as NEW;

-- 6. Check recent auth.users table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'auth'
ORDER BY ordinal_position;
