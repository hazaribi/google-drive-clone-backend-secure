-- Only run this AFTER tables are created and verified
CREATE INDEX IF NOT EXISTS idx_files_search ON files USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_folders_search ON folders USING gin(to_tsvector('english', name));