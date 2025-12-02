-- Query to find all tables that depend on the 'clients' table
-- This includes foreign keys, references, and other dependencies

-- 1. Find all foreign key constraints that reference the clients table
SELECT 
    tc.table_name AS dependent_table,
    kcu.column_name AS dependent_column,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column,
    tc.constraint_name AS foreign_key_name,
    'FOREIGN KEY' AS dependency_type
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'clients'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 2. Find all tables that might reference clients (even without formal FK constraints)
SELECT DISTINCT
    schemaname,
    tablename AS table_name,
    'POTENTIAL REFERENCE' AS dependency_type
FROM pg_tables 
WHERE schemaname = 'public'
    AND tablename != 'clients'
    AND EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
            AND table_name = pg_tables.tablename
            AND column_name LIKE '%client%'
            OR column_name LIKE '%user_id%'
    )
ORDER BY tablename;

-- 3. Find all columns that might be foreign keys to clients (by naming convention)
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    'COLUMN REFERENCE' AS dependency_type
FROM information_schema.columns 
WHERE table_schema = 'public'
    AND table_name != 'clients'
    AND (
        column_name LIKE '%client_id%' 
        OR column_name LIKE '%client%'
        OR (column_name = 'user_id' AND table_name NOT IN ('clients', 'users'))
    )
ORDER BY table_name, column_name;

-- 4. Find all views that depend on the clients table
SELECT 
    schemaname,
    viewname AS view_name,
    definition,
    'VIEW DEPENDENCY' AS dependency_type
FROM pg_views 
WHERE schemaname = 'public'
    AND definition ILIKE '%clients%'
ORDER BY viewname;

-- 5. Find all functions/triggers that reference clients table
SELECT 
    n.nspname AS schema_name,
    p.proname AS function_name,
    'FUNCTION REFERENCE' AS dependency_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prosrc ILIKE '%clients%'
ORDER BY p.proname;

-- 6. Find RLS policies on clients table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    'RLS POLICY' AS dependency_type
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename = 'clients'
ORDER BY policyname;

-- 7. Summary query - count of dependencies by type
SELECT 
    dependency_type,
    COUNT(*) as count
FROM (
    SELECT 'FOREIGN KEY' AS dependency_type FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'clients' AND tc.table_schema = 'public'
    
    UNION ALL
    
    SELECT 'COLUMN REFERENCE' AS dependency_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name != 'clients' 
    AND (column_name LIKE '%client_id%' OR column_name LIKE '%client%')
    
    UNION ALL
    
    SELECT 'VIEW DEPENDENCY' AS dependency_type FROM pg_views 
    WHERE schemaname = 'public' AND definition ILIKE '%clients%'
) AS all_deps
GROUP BY dependency_type
ORDER BY count DESC;
