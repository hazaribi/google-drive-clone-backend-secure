import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../types';

export const checkFilePermission = (requiredPermission: 'view' | 'edit' | 'owner') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.userId;

      // Check if user is owner
      const { data: file } = await supabase
        .from('files')
        .select('owner_id')
        .eq('id', id)
        .single();

      if (file?.owner_id === userId) {
        return next(); // Owner has all permissions
      }

      // Check explicit permissions
      const { data: permission } = await supabase
        .from('file_permissions')
        .select('permission')
        .eq('file_id', id)
        .eq('user_id', userId)
        .single();

      if (!permission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const permissionLevels: Record<string, number> = { view: 1, edit: 2, owner: 3 };
      if (permissionLevels[permission.permission] < permissionLevels[requiredPermission]) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

export const checkFolderPermission = (requiredPermission: 'view' | 'edit' | 'owner') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.userId;

      // Check if user is owner
      const { data: folder } = await supabase
        .from('folders')
        .select('owner_id')
        .eq('id', id)
        .single();

      if (folder?.owner_id === userId) {
        return next(); // Owner has all permissions
      }

      // Check explicit permissions
      const { data: permission } = await supabase
        .from('folder_permissions')
        .select('permission')
        .eq('folder_id', id)
        .eq('user_id', userId)
        .single();

      if (!permission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const permissionLevels: Record<string, number> = { view: 1, edit: 2, owner: 3 };
      if (permissionLevels[permission.permission] < permissionLevels[requiredPermission]) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};