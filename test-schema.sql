-- Test if files table exists and has name column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'files' AND column_name = 'name';

-- If above returns no rows, create the files table first:
CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  size BIGINT NOT NULL,
  format VARCHAR(100) NOT NULL,
  path TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL,
  folder_id INTEGER,
  share_token VARCHAR(255) UNIQUE,
  is_public BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Then create the index
CREATE INDEX IF NOT EXISTS idx_files_search ON files USING gin(to_tsvector('english', name));