import express, { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../types';
import { authenticateUser } from '../middleware/auth';
import { sanitizeInput, sanitizeOutput, validateInteger, sanitizeQueryParam, sanitizeErrorMessage } from '../utils/security';

const router = express.Router();

// Full-text search with pagination
router.get('/', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { q, type = 'all', limit = 20, page = 1 } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const sanitizedQuery = sanitizeInput(q.trim());
    const sanitizedType = sanitizeInput(type as string);
    const searchQuery = sanitizedQuery;
    const pageSize = Math.min(validateInteger(limit, 1, 50) || 20, 50);
    const pageNum = validateInteger(page, 1) || 1;
    const offset = (pageNum - 1) * pageSize;
    const results: any = { query: sanitizeOutput(searchQuery), files: [], folders: [], pagination: {} };

    // Search files using full-text search
    if (sanitizedType === 'all' || sanitizedType === 'files') {
      const { data: files } = await supabase
        .rpc('search_files_paginated', {
          search_query: searchQuery,
          user_id: req.userId,
          page_limit: pageSize,
          page_offset: offset
        });

      results.files = files || [];
    }

    // Search folders using full-text search
    if (sanitizedType === 'all' || sanitizedType === 'folders') {
      const { data: folders } = await supabase
        .rpc('search_folders_paginated', {
          search_query: searchQuery,
          user_id: req.userId,
          page_limit: pageSize,
          page_offset: offset
        });

      results.folders = folders || [];
    }

    // Sanitize results
    results.files = results.files?.map((file: any) => ({
      ...file,
      name: sanitizeOutput(file.name),
      format: sanitizeOutput(file.format)
    }));
    
    results.folders = results.folders?.map((folder: any) => ({
      ...folder,
      name: sanitizeOutput(folder.name)
    }));
    
    results.pagination = {
      page: pageNum,
      limit: pageSize,
      hasMore: (results.files?.length || 0) + (results.folders?.length || 0) === pageSize
    };

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) });
  }
});

// Advanced search with filters
router.get('/advanced', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { q, format, size_min, size_max, date_from, date_to } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const sanitizedQuery = sanitizeInput(q.trim());
    const sanitizedFormat = sanitizeQueryParam(format as string);
    const sanitizedSizeMin = validateInteger(size_min, 0);
    const sanitizedSizeMax = validateInteger(size_max, 0);
    const sanitizedDateFrom = sanitizeQueryParam(date_from as string);
    const sanitizedDateTo = sanitizeQueryParam(date_to as string);

    let query = supabase
      .from('files')
      .select('*')
      .eq('owner_id', req.userId)
      .is('deleted_at', null)
      .textSearch('name', q.trim());

    // Apply filters
    if (sanitizedFormat) query = query.eq('format', sanitizedFormat);
    if (sanitizedSizeMin) query = query.gte('size', sanitizedSizeMin);
    if (sanitizedSizeMax) query = query.lte('size', sanitizedSizeMax);
    if (sanitizedDateFrom) query = query.gte('created_at', sanitizedDateFrom);
    if (sanitizedDateTo) query = query.lte('created_at', sanitizedDateTo);

    const { data, error } = await query.limit(50);

    if (error) {
      return res.status(500).json({ error: sanitizeErrorMessage(error) });
    }

    const sanitizedResults = data?.map(file => ({
      ...file,
      name: sanitizeOutput(file.name),
      format: sanitizeOutput(file.format)
    }));
    
    res.json({
      query: sanitizeOutput(sanitizedQuery),
      filters: { 
        format: sanitizeOutput(sanitizedFormat), 
        size_min: sanitizedSizeMin, 
        size_max: sanitizedSizeMax, 
        date_from: sanitizeOutput(sanitizedDateFrom), 
        date_to: sanitizeOutput(sanitizedDateTo) 
      },
      results: sanitizedResults || []
    });
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) });
  }
});

export default router;