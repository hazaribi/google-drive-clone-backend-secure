import express, { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../types';
import { authenticateUser } from '../middleware/auth';
import { checkFilePermission } from '../middleware/permissions';
import { csrfProtection } from '../middleware/csrf';
import { sanitizeInput, sanitizeFileName, sanitizeOutput, validateInteger, sanitizeQueryParam, validateFilePath, isValidUUID, sanitizeErrorMessage } from '../utils/security';
import { validateFileUpload, userRateLimit } from '../middleware/validation';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB to prevent DoS
    files: 1 // Only allow single file upload
  },
  fileFilter: (req, file, cb) => {
    // Validate file types to prevent malicious uploads
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'text/csv',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', 'application/x-zip-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed') as any, false);
    }
  }
});

// Upload file
router.post('/upload', csrfProtection, authenticateUser, userRateLimit(10, 60000), upload.single('file'), validateFileUpload, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { folderId } = req.body;
    const sanitizedName = sanitizeFileName(req.file.originalname);
    const fileName = `${req.userId}/${Date.now()}_${sanitizedName}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('files')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      return res.status(500).json({ error: sanitizeErrorMessage(uploadError) });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('files')
      .getPublicUrl(fileName);
    
    // Save file metadata to database
    const { data, error } = await supabase
      .from('files')
      .insert([{
        name: req.file.originalname,
        size: req.file.size,
        format: req.file.mimetype,
        path: publicUrl,
        storage_path: fileName,
        owner_id: req.userId,
        folder_id: folderId || null
      }])
      .select()
      .single();

    if (error) {
      // Clean up uploaded file if database insert fails
      await supabase.storage.from('files').remove([fileName]);
      return res.status(500).json({ error: sanitizeErrorMessage(error) });
    }

    // Auto-grant owner permission
    await supabase
      .from('file_permissions')
      .insert([{
        file_id: data.id,
        user_id: req.userId,
        permission: 'owner'
      }]);

    res.json({ message: 'File uploaded successfully', file: data });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get files with pagination
router.get('/', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { folderId, limit = 20, page = 1, cursor } = req.query;
    const pageSize = Math.min(validateInteger(limit, 1, 100) || 20, 100);
    const sanitizedFolderId = folderId ? sanitizeQueryParam(folderId) : null;
    const sanitizedCursor = cursor ? sanitizeQueryParam(cursor) : null;
    
    let query = supabase
      .from('files')
      .select('id, name, size, format, path, folder_id, created_at, updated_at', { count: 'exact' })
      .eq('owner_id', req.userId)
      .is('deleted_at', null);
    
    if (sanitizedFolderId && sanitizedFolderId !== 'null' && isValidUUID(sanitizedFolderId)) {
      query = query.eq('folder_id', sanitizedFolderId);
    } else {
      query = query.is('folder_id', null);
    }
    
    if (sanitizedCursor) {
      query = query.lt('created_at', sanitizedCursor);
    }
    
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(pageSize);

    if (error) return res.status(500).json({ error: sanitizeErrorMessage(error) });
    
    const sanitizedData = data?.map(file => ({
      ...file,
      name: sanitizeOutput(file.name),
      format: sanitizeOutput(file.format)
    }));
    
    const hasMore = sanitizedData && sanitizedData.length === pageSize;
    const nextCursor = hasMore ? sanitizedData[sanitizedData.length - 1].created_at : null;
    
    res.json({
      data: sanitizedData,
      pagination: {
        page: validateInteger(page, 1) || 1,
        limit: pageSize,
        total: count,
        hasMore,
        nextCursor
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Soft delete file (move to trash)
router.delete('/:id', csrfProtection, authenticateUser, checkFilePermission('owner'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', req.userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ message: 'File moved to trash', file: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Rename file
router.put('/:id', csrfProtection, authenticateUser, checkFilePermission('edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const sanitizedId = sanitizeQueryParam(id);
    const sanitizedName = sanitizeFileName(name);

    if (!isValidUUID(sanitizedId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    if (!sanitizedName || sanitizedName.length === 0) {
      return res.status(400).json({ error: 'Valid file name is required' });
    }

    const { data, error } = await supabase
      .from('files')
      .update({ name: sanitizedName })
      .eq('id', sanitizedId)
      .eq('owner_id', req.userId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: sanitizeErrorMessage(error) });
    }

    if (!data) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ 
      message: 'File renamed successfully', 
      file: { ...data, name: sanitizeOutput(data.name) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

// Get trash files with pagination
router.get('/trash', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const pageSize = Math.min(validateInteger(limit, 1, 100) || 20, 100);
    const pageNum = validateInteger(page, 1) || 1;
    const offset = (pageNum - 1) * pageSize;

    const { data, error, count } = await supabase
      .from('files')
      .select('id, name, size, format, deleted_at, created_at', { count: 'exact' })
      .eq('owner_id', req.userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) return res.status(500).json({ error: sanitizeErrorMessage(error) });
    
    const sanitizedData = data?.map(file => ({
      ...file,
      name: sanitizeOutput(file.name),
      format: sanitizeOutput(file.format)
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

// Restore file from trash
router.post('/:id/restore', csrfProtection, authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('files')
      .update({ deleted_at: null })
      .eq('id', id)
      .eq('owner_id', req.userId)
      .not('deleted_at', 'is', null)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'File not found in trash' });
    }

    res.json({ message: 'File restored successfully', file: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore file' });
  }
});

// Permanently delete file
router.delete('/:id/permanent', csrfProtection, authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('storage_path')
      .eq('id', id)
      .eq('owner_id', req.userId)
      .not('deleted_at', 'is', null)
      .single();

    if (fetchError || !file) {
      return res.status(404).json({ error: 'File not found in trash' });
    }

    // Delete from storage
    await supabase.storage.from('files').remove([file.storage_path]);

    // Delete from database
    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', id)
      .eq('owner_id', req.userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'File permanently deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to permanently delete file' });
  }
});

// Generate shareable link
router.post('/:id/share', csrfProtection, authenticateUser, checkFilePermission('owner'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const shareToken = uuidv4();

    const { data, error } = await supabase
      .from('files')
      .update({ 
        share_token: shareToken,
        is_public: true 
      })
      .eq('id', id)
      .eq('owner_id', req.userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'File not found' });
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const shareUrl = `${clientUrl}/share/${encodeURIComponent(shareToken)}`;
    res.json({ 
      message: 'Share link generated',
      shareUrl,
      shareToken,
      file: data 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate share link' });
  }
});

// Remove sharing
router.delete('/:id/share', csrfProtection, authenticateUser, checkFilePermission('owner'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('files')
      .update({ 
        share_token: null,
        is_public: false 
      })
      .eq('id', id)
      .eq('owner_id', req.userId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ message: 'Sharing disabled', file: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disable sharing' });
  }
});

// Access shared file (public endpoint)
router.get('/shared/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const sanitizedToken = sanitizeQueryParam(token);

    if (!isValidUUID(sanitizedToken)) {
      return res.status(400).json({ error: 'Invalid share token' });
    }

    const { data: file, error } = await supabase
      .from('files')
      .select('id, name, size, format, path, created_at')
      .eq('share_token', sanitizedToken)
      .eq('is_public', true)
      .is('deleted_at', null)
      .single();

    if (error || !file) {
      return res.status(404).json({ error: 'Shared file not found' });
    }

    res.json({
      id: file.id,
      name: sanitizeOutput(file.name),
      size: file.size,
      format: sanitizeOutput(file.format),
      path: file.path,
      created_at: file.created_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to access shared file' });
  }
});

// Share file with user
router.post('/:id/permissions', csrfProtection, authenticateUser, checkFilePermission('owner'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email, permission } = req.body;
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPermission = sanitizeInput(permission);
    const sanitizedId = sanitizeQueryParam(id);

    if (!isValidUUID(sanitizedId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
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
      .from('file_permissions')
      .upsert({
        file_id: sanitizedId,
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

// Remove file permission
router.delete('/:id/permissions/:userId', csrfProtection, authenticateUser, checkFilePermission('owner'), async (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;
    const sanitizedId = sanitizeQueryParam(id);
    const sanitizedUserId = sanitizeQueryParam(userId);

    if (!isValidUUID(sanitizedId) || !isValidUUID(sanitizedUserId)) {
      return res.status(400).json({ error: 'Invalid file or user ID' });
    }

    const { error } = await supabase
      .from('file_permissions')
      .delete()
      .eq('file_id', sanitizedId)
      .eq('user_id', sanitizedUserId);

    if (error) {
      return res.status(500).json({ error: sanitizeErrorMessage(error) });
    }

    res.json({ message: 'Permission removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove permission' });
  }
});

// Get file permissions
router.get('/:id/permissions', csrfProtection, authenticateUser, checkFilePermission('owner'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const sanitizedId = sanitizeQueryParam(id);

    if (!isValidUUID(sanitizedId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const { data, error } = await supabase
      .from('file_permissions')
      .select(`
        id,
        permission,
        created_at,
        users!inner(id, email, name)
      `)
      .eq('file_id', sanitizedId);

    if (error) {
      return res.status(500).json({ error: sanitizeErrorMessage(error) });
    }

    const sanitizedData = data?.map((perm: any) => ({
      ...perm,
      permission: sanitizeOutput(perm.permission),
      users: {
        ...perm.users,
        email: sanitizeOutput(perm.users.email),
        name: sanitizeOutput(perm.users.name)
      }
    }));

    res.json(sanitizedData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Generate signed URL for secure download
router.get('/:id/download', authenticateUser, checkFilePermission('view'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const sanitizedId = sanitizeQueryParam(id);
    const expiresIn = 3600;

    if (!isValidUUID(sanitizedId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('storage_path, name')
      .eq('id', sanitizedId)
      .is('deleted_at', null)
      .single();

    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!validateFilePath(file.storage_path)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const { data, error } = await supabase.storage
      .from('files')
      .createSignedUrl(file.storage_path, expiresIn);

    if (error) {
      return res.status(500).json({ error: sanitizeErrorMessage(error) });
    }

    res.json({
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      fileName: sanitizeOutput(file.name)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

// Generate signed URL for shared file
router.get('/shared/:token/download', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const sanitizedToken = sanitizeQueryParam(token);
    const expiresIn = 3600;

    if (!isValidUUID(sanitizedToken)) {
      return res.status(400).json({ error: 'Invalid share token' });
    }

    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('storage_path, name')
      .eq('share_token', sanitizedToken)
      .eq('is_public', true)
      .is('deleted_at', null)
      .single();

    if (fileError || !file) {
      return res.status(404).json({ error: 'Shared file not found' });
    }

    if (!validateFilePath(file.storage_path)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const { data, error } = await supabase.storage
      .from('files')
      .createSignedUrl(file.storage_path, expiresIn);

    if (error) {
      return res.status(500).json({ error: sanitizeErrorMessage(error) });
    }

    res.json({
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      fileName: sanitizeOutput(file.name)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});



export default router;