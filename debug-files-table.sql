-- Check if files table exists and what columns it has
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'files' 
ORDER BY ordinal_position;

-- Also check table definition
SELECT table_name FROM information_schema.tables WHERE table_name = 'files';