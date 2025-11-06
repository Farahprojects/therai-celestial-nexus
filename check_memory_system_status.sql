-- Memory System Implementation Status Check
-- Run this to verify what has been applied

-- 1. Check if profile_id column exists on conversations
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'conversations' 
  AND column_name = 'profile_id';

-- 2. Check if memory_type enum exists
SELECT 
  t.typname as enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'memory_type'
GROUP BY t.typname;

-- 3. Check if user_memory table exists with all columns
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_memory'
ORDER BY ordinal_position;

-- 4. Check if indexes exist
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('conversations', 'user_memory', 'user_memory_weekly_summaries', 'user_memory_monthly_summaries')
ORDER BY tablename, indexname;

-- 5. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('user_memory', 'user_memory_weekly_summaries', 'user_memory_monthly_summaries')
  AND schemaname = 'public';

-- 6. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename IN ('user_memory', 'user_memory_weekly_summaries', 'user_memory_monthly_summaries')
ORDER BY tablename, policyname;

-- 7. Check constraint on user_profile_list (unique primary per user)
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'user_profile_list'::regclass
  AND conname LIKE '%primary%';

-- 8. Check if weekly_summaries table exists
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'user_memory_weekly_summaries'
ORDER BY ordinal_position;

-- 9. Check if monthly_summaries table exists
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'user_memory_monthly_summaries'
ORDER BY ordinal_position;

-- 10. Sample data check (if any exists)
SELECT 
  COUNT(*) as total_memories,
  COUNT(*) FILTER (WHERE is_active = true) as active_memories,
  COUNT(DISTINCT user_id) as users_with_memories,
  COUNT(DISTINCT profile_id) as profiles_with_memories
FROM user_memory;

