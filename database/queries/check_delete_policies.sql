-- Check RLS policies for DELETE operations on insights, report_logs, translator_logs

-- Check insights table policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'insights' 
AND cmd = 'DELETE';

-- Check report_logs table policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'report_logs' 
AND cmd = 'DELETE';

-- Check translator_logs table policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'translator_logs' 
AND cmd = 'DELETE';

-- Check if RLS is enabled on these tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('insights', 'report_logs', 'translator_logs');
