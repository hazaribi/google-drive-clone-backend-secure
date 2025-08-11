-- Drop the broken files table and recreate
DROP TABLE IF EXISTS files CASCADE;

-- Recreate files table
CREATE TABLE files (
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

-- Create the index
CREATE INDEX idx_files_search ON files USING gin(to_tsvector('english', name));