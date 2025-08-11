import express, { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../types';
import { authenticateUser } from '../middleware/auth';
import { checkFolderPermission } from '../middleware/permissions';
import { csrfProtection } from '../middleware/csrf';
import { sanitizeInput, sanitizeOutput, validateInteger, sanitizeQueryParam, isValidUUID, sanitizeErrorMessage } from '../utils/security';

const router = express.Router();

// Create folder
router.post('/', csrfProtection, authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { name, parentId } = req.body;
    const sanitizedName = sanitizeInput(name);
    
    if (!sanitizedName || sanitizedName.trim().length === 0) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const { data, error } = await supabase
      .from('folders')
      .insert([{
        name: sanitizedName.trim(),
        owner_id: req.userId,
        parent_id: parentId || null
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Folder with this name already exists' });
      }
      return res.status(500).json({ error: sanitizeErrorMessage(error) });
    }

    res.status(201).json({ message: 'Folder created successfully', folder: data });
  } catch (error) {
    res.status(500).json({ error: 'Folder creation failed' });
  }
});

// Get folders
router.get('/', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { parentId, limit = 100 } = req.query;
    const sanitizedParentId = parentId ? sanitizeQueryParam(parentId) : null;
    const limitNum = Math.min(validateInteger(limit, 1, 100) || 100, 100);
    
    let query = supabase
      .from('folders')
      .select('id, name, parent_id, created_at, updated_at')
      .eq('owner_id', req.userId)
      .is('deleted_at', null);
    
    if (sanitizedParentId && sanitizedParentId !== 'null' && isValidUUID(sanitizedParentId)) {
      query = query.eq('parent_id', sanitizedParentId);
    } else {
      query = query.is('parent_id', null);
    }
    
    const { data, error } = await query
      .order('name')
      .limit(limitNum);

    if (error) return res.status(500).json({ error: sanitizeErrorMessage(error) });
    
    const sanitizedData = data?.map(folder => ({
      ...folder,
      name: sanitizeOutput(folder.name)
    }));
    
    res.json(sanitizedData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// Soft delete folder
router.delete('/:id', csrfProtection, authenticateUser, checkFolderPermission('owner'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('folders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', req.userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ message: 'Folder moved to trash', folder: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// Rename folder
router.put('/:id', csrfProtection, authenticateUser, checkFolderPermission('edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const sanitizedId = sanitizeQueryParam(id);
    const sanitizedName = sanitizeInput(name);

    if (!isValidUUID(sanitizedId)) {
      return res.status(400).json({ error: 'Invalid folder ID' });
    }

    if (!sanitizedName || sanitizedName.length === 0) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const { data, error } = await supabase
      .from('folders')
      .update({ name: sanitizedName })
      .eq('id', sanitizedId)
      .eq('owner_id', req.userId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Folder with this name already exists' });
      }
      return res.status(500).json({ error: sanitizeErrorMessage(error) });
    }

    if (!data) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ 
      message: 'Folder renamed successfully', 
      folder: { ...data, name: sanitizeOutput(data.name) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename folder' });
  }
});

// Get trash folders with pagination
router.get('/trash', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const pageSize = Math.min(validateInteger(limit, 1, 100) || 20, 100);
    const pageNum = validateInteger(page, 1) || 1;
    const offset = (pageNum - 1) * pageSize;

    const { data, error, count } = await supabase
      .from('folders')
      .select('id, name, parent_id, deleted_at, created_at', { count: 'exact' })
      .eq('owner_id', req.userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) return res.status(500).json({ error: sanitizeErrorMessage(error) });
    
    const sanitizedData = data?.map(folder => ({
      ...folder,
      name: sanitizeOutput(folder.name)
    }));
    
    res.json({
      data: sanitizedData,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: count,
        totalPages: Math.ceil((count || 0) / pageSize),
        hasMore: offset + pageSize < (count || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trash' });
  }
});

// Restore folder from trash
router.post('/:id/restore', csrfProtection, authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('folders')
      .update({ deleted_at: null })
      .eq('id', id)
      .eq('owner_id', req.userId)
      .not('deleted_at', 'is', null)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Folder not found in trash' });
    }

    res.json({ message: 'Folder restored successfully', folder: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore folder' });
  }
});

// Share folder with user
router.post('/:id/permissions', csrfProtection, authenticateUser, checkFolderPermission('owner'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email, permission } = req.body;
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPermission = sanitizeInput(permission);
    const sanitizedId = sanitizeQueryParam(id);

    if (!isValidUUID(sanitizedId)) {
      return res.status(400).json({ error: 'Invalid folder ID' });
    }

    if (!sanitizedEmail || !sanitizedPermission || !['view', 'edit'].includes(sanitizedPermission)) {
      return res.status(400).json({ error: 'Valid email and permission (view/edit) required' });
    }

    // Get user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', sanitizedEmail)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add permission
    const { data, error } = await supabase
      .from('folder_permissions')
      .upsert({
        folder_id: sanitizedId,
        user_id: user.id,
        permission: sanitizedPermission
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Permission granted', permission: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to grant permission' });
  }
});



export default router;