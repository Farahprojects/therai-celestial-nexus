-- Check if assign_message_number trigger exists and is enabled
SELECT 
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  tgenabled AS enabled,
  CASE tgenabled
    WHEN 'O' THEN 'Enabled'
    WHEN 'D' THEN 'Disabled'
    WHEN 'R' THEN 'Replica'
    WHEN 'A' THEN 'Always'
  END AS status,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgname = 'assign_message_number'
  AND tgrelid = 'public.messages'::regclass;

-- Also check if the function exists
SELECT 
  proname AS function_name,
  prokind AS kind,
  CASE prokind
    WHEN 'f' THEN 'Function'
    WHEN 'p' THEN 'Procedure'
    WHEN 'a' THEN 'Aggregate'
    WHEN 'w' THEN 'Window'
  END AS function_type
FROM pg_proc
WHERE proname IN ('assign_message_number', 'get_next_message_number')
  AND pronamespace = 'public'::regnamespace;

