-- Create remaining tables and indexes
CREATE TABLE IF NOT EXISTS folders (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id UUID NOT NULL,
  parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, owner_id, parent_id)
);

CREATE TABLE IF NOT EXISTS file_permissions (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission VARCHAR(10) NOT NULL CHECK (permission IN ('view', 'edit', 'owner')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(file_id, user_id)
);

CREATE TABLE IF NOT EXISTS folder_permissions (
  id SERIAL PRIMARY KEY,
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission VARCHAR(10) NOT NULL CHECK (permission IN ('view', 'edit', 'owner')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(folder_id, user_id)
);

-- Create remaining indexes
CREATE INDEX IF NOT EXISTS idx_folders_search ON folders USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_files_owner_deleted ON files(owner_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_folders_owner_deleted ON folders(owner_id, deleted_at) WHERE deleted_at IS NULL;