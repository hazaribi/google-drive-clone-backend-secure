-- Google Drive Clone Database Schema
-- Run this in your Supabase SQL Editor

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  name VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, owner_id, parent_id)
);

-- Create files table
CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  size BIGINT NOT NULL,
  format VARCHAR(100) NOT NULL,
  path TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  share_token VARCHAR(255) UNIQUE,
  is_public BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for folders
CREATE POLICY "Users can manage own folders" ON folders FOR ALL USING (owner_id = auth.uid());

-- RLS Policies for files
CREATE POLICY "Users can manage own files" ON files FOR ALL USING (owner_id = auth.uid());

-- Storage policies
CREATE POLICY "Users can upload files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'files');
CREATE POLICY "Users can view own files" ON storage.objects FOR SELECT USING (bucket_id = 'files');
CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE USING (bucket_id = 'files');

-- Create file permissions table
CREATE TABLE IF NOT EXISTS file_permissions (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(10) NOT NULL CHECK (permission IN ('view', 'edit', 'owner')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(file_id, user_id)
);

-- Create folder permissions table
CREATE TABLE IF NOT EXISTS folder_permissions (
  id SERIAL PRIMARY KEY,
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(10) NOT NULL CHECK (permission IN ('view', 'edit', 'owner')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(folder_id, user_id)
);

-- Create full-text search indexes (ensure tables exist first)
CREATE INDEX IF NOT EXISTS idx_files_search ON files USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_folders_search ON folders USING gin(to_tsvector('english', name));

-- Create composite indexes for better performance
CREATE INDEX IF NOT EXISTS idx_files_owner_deleted ON files(owner_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_files_folder_deleted ON files(folder_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_folders_owner_deleted ON folders(owner_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_folders_parent_deleted ON folders(parent_id, deleted_at) WHERE deleted_at IS NULL;

-- Permission lookup optimization
CREATE INDEX IF NOT EXISTS idx_file_permissions_user_file ON file_permissions(user_id, file_id);
CREATE INDEX IF NOT EXISTS idx_folder_permissions_user_folder ON folder_permissions(user_id, folder_id);

-- Share token lookup
CREATE INDEX IF NOT EXISTS idx_files_share_token ON files(share_token) WHERE share_token IS NOT NULL;

-- Date-based queries
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at DESC) WHERE deleted_at IS NOT NULL;

-- Format and size filters
CREATE INDEX IF NOT EXISTS idx_files_format ON files(format);
CREATE INDEX IF NOT EXISTS idx_files_size ON files(size);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create search functions
CREATE OR REPLACE FUNCTION search_files(search_query TEXT, user_id UUID)
RETURNS TABLE(
  id INTEGER,
  name VARCHAR(255),
  size BIGINT,
  format VARCHAR(100),
  path TEXT,
  folder_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  WITH user_files AS (
    SELECT DISTINCT f.id
    FROM files f
    LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.user_id = user_id
    WHERE f.deleted_at IS NULL
      AND (f.owner_id = user_id OR fp.permission IS NOT NULL)
  )
  SELECT 
    f.id,
    f.name,
    f.size,
    f.format,
    f.path,
    f.folder_id,
    f.created_at,
    ts_rank(to_tsvector('english', f.name), plainto_tsquery('english', search_query)) as rank
  FROM files f
  INNER JOIN user_files uf ON f.id = uf.id
  WHERE to_tsvector('english', f.name) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, f.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION search_folders(search_query TEXT, user_id UUID)
RETURNS TABLE(
  id INTEGER,
  name VARCHAR(255),
  parent_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fo.id,
    fo.name,
    fo.parent_id,
    fo.created_at,
    ts_rank(to_tsvector('english', fo.name), plainto_tsquery('english', search_query)) as rank
  FROM folders fo
  LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id
  WHERE 
    fo.deleted_at IS NULL
    AND (
      fo.owner_id = user_id 
      OR (fop.user_id = user_id AND fop.permission IN ('view', 'edit', 'owner'))
    )
    AND to_tsvector('english', fo.name) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, fo.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Paginated search functions
CREATE OR REPLACE FUNCTION search_files_paginated(search_query TEXT, user_id UUID, page_limit INTEGER, page_offset INTEGER)
RETURNS TABLE(
  id INTEGER,
  name VARCHAR(255),
  size BIGINT,
  format VARCHAR(100),
  path TEXT,
  folder_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  WITH user_files AS (
    SELECT DISTINCT f.id
    FROM files f
    LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.user_id = user_id
    WHERE f.deleted_at IS NULL
      AND (f.owner_id = user_id OR fp.permission IS NOT NULL)
  )
  SELECT 
    f.id,
    f.name,
    f.size,
    f.format,
    f.path,
    f.folder_id,
    f.created_at,
    ts_rank(to_tsvector('english', f.name), plainto_tsquery('english', search_query)) as rank
  FROM files f
  INNER JOIN user_files uf ON f.id = uf.id
  WHERE to_tsvector('english', f.name) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, f.created_at DESC
  LIMIT page_limit OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION search_folders_paginated(search_query TEXT, user_id UUID, page_limit INTEGER, page_offset INTEGER)
RETURNS TABLE(
  id INTEGER,
  name VARCHAR(255),
  parent_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fo.id,
    fo.name,
    fo.parent_id,
    fo.created_at,
    ts_rank(to_tsvector('english', fo.name), plainto_tsquery('english', search_query)) as rank
  FROM folders fo
  LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id
  WHERE 
    fo.deleted_at IS NULL
    AND (
      fo.owner_id = user_id 
      OR (fop.user_id = user_id AND fop.permission IN ('view', 'edit', 'owner'))
    )
    AND to_tsvector('english', fo.name) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, fo.created_at DESC
  LIMIT page_limit OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;