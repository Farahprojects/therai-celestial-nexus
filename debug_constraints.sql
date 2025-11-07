-- Check all constraints on the conversations table
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition,
  convalidated AS is_validated
FROM pg_constraint
WHERE conrelid = 'public.conversations'::regclass
  AND conname LIKE '%mode%';

-- Also check if there are any triggers that might interfere
SELECT
  tgname AS trigger_name,
  tgtype,
  tgenabled,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.conversations'::regclass
  AND tgname LIKE '%mode%';

