-- Check if permission tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('file_permissions', 'folder_permissions');

-- Check columns in permission tables if they exist
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('file_permissions', 'folder_permissions')
ORDER BY table_name, ordinal_position;