-- Drop and recreate folders table with correct foreign key
DROP TABLE IF EXISTS folder_permissions CASCADE;
DROP TABLE IF EXISTS folders CASCADE;

-- Recreate folders table without foreign key constraint
CREATE TABLE folders (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id UUID NOT NULL,
  parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, owner_id, parent_id)
);

-- Recreate folder_permissions table
CREATE TABLE folder_permissions (
  id SERIAL PRIMARY KEY,
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission VARCHAR(10) NOT NULL CHECK (permission IN ('view', 'edit', 'owner')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(folder_id, user_id)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_folders_search ON folders USING gin(to_tsvector('english', name));