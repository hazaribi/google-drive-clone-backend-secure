import { Request } from 'express';

export interface AuthRequest extends Request {
  userId?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  google_id?: string;
  created_at: string;
}

export interface FileRecord {
  id: number;
  name: string;
  size: number;
  format: string;
  path: string;
  storage_path: string;
  owner_id: string;
  folder_id?: number;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: number;
  name: string;
  owner_id: string;
  parent_id?: number;
  created_at: string;
  updated_at: string;
}