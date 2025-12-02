-- ============================================
-- MESSAGES TABLE HEALTH CHECK
-- Run these queries in Supabase SQL Editor
-- ============================================

-- 1. Show all indexes on messages table
SELECT 
    indexname AS index_name,
    indexdef AS index_definition
FROM pg_indexes
WHERE tablename = 'messages'
ORDER BY indexname;

-- 2. Show table size and index sizes
SELECT
    pg_size_pretty(pg_total_relation_size('messages')) AS total_size,
    pg_size_pretty(pg_relation_size('messages')) AS table_size,
    pg_size_pretty(pg_total_relation_size('messages') - pg_relation_size('messages')) AS indexes_size;

-- 3. Show all indexes with their sizes individually
SELECT
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) AS index_size,
    idx_scan AS times_used,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE relname = 'messages'
ORDER BY pg_relation_size(indexrelid::regclass) DESC;

-- 4. Show all constraints on messages table
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'messages'::regclass
ORDER BY conname;

-- 5. Show all triggers on messages table
SELECT
    tgname AS trigger_name,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'messages'::regclass
    AND tgisinternal = false
ORDER BY tgname;

-- 6. Show foreign keys referencing messages
SELECT
    conname AS fk_name,
    conrelid::regclass AS from_table,
    a.attname AS from_column,
    confrelid::regclass AS to_table,
    af.attname AS to_column
FROM pg_constraint
JOIN pg_attribute a ON a.attrelid = conrelid AND a.attnum = ANY(conkey)
JOIN pg_attribute af ON af.attrelid = confrelid AND af.attnum = ANY(confkey)
WHERE confrelid = 'messages'::regclass
    AND contype = 'f'
ORDER BY conname;

-- 7. Show column statistics and data types
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- 8. Show table statistics (rows, dead tuples)
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE relname = 'messages';

-- 9. Check for unused indexes (never used or rarely used)
SELECT
    schemaname || '.' || relname AS table,
    indexrelname AS index,
    pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
    idx_scan AS index_scans
FROM pg_stat_user_indexes ui
JOIN pg_index i ON ui.indexrelid = i.indexrelid
WHERE ui.relname = 'messages'
    AND idx_scan < 10 -- indexes used less than 10 times
    AND NOT indisunique -- exclude unique indexes (they're needed for constraints)
ORDER BY pg_relation_size(i.indexrelid) DESC;

