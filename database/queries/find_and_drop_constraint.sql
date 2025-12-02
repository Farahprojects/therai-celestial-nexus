-- Find and drop the existing check constraint that's causing the error

-- First, let's find where this constraint exists
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
    AND tc.constraint_name = 'insights_status_check';

-- Also check if there are any similar constraint names
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
    AND tc.constraint_name LIKE '%insights%status%';

-- If we find the constraint, we can drop it with:
-- ALTER TABLE [table_name] DROP CONSTRAINT insights_status_check;

-- Let's also check for any remaining insights-related tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%insight%';
