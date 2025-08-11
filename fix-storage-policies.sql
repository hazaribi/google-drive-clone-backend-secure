-- Drop existing storage policies and create permissive ones
DROP POLICY IF EXISTS "Users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Create permissive storage policies
CREATE POLICY "Allow all uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'files');
CREATE POLICY "Allow all reads" ON storage.objects FOR SELECT USING (bucket_id = 'files');
CREATE POLICY "Allow all deletes" ON storage.objects FOR DELETE USING (bucket_id = 'files');
CREATE POLICY "Allow all updates" ON storage.objects FOR UPDATE USING (bucket_id = 'files');