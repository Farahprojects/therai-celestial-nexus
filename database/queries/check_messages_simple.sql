-- Simple check: What indexes exist on messages table?
SELECT 
    indexname AS index_name,
    indexdef AS definition
FROM pg_indexes
WHERE tablename = 'messages'
ORDER BY indexname;

-- Simple check: What constraints exist on messages table?
SELECT
    conname AS constraint_name,
    contype AS type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'messages'::regclass
ORDER BY conname;

-- Simple check: Basic table info
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

