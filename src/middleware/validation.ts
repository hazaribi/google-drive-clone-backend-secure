import { Request, Response, NextFunction } from 'express';
import { sanitizeInput, sanitizeQueryParam, isValidUUID, validateInteger } from '../utils/security';

/**
 * Validate and sanitize request parameters
 */
export const validateParams = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize URL parameters
    if (req.params) {
      for (const [key, value] of Object.entries(req.params)) {
        if (typeof value === 'string') {
          req.params[key] = sanitizeQueryParam(value);
          
          // Validate UUID parameters
          if (key === 'id' || key.endsWith('Id')) {
            if (!isValidUUID(req.params[key])) {
              return res.status(400).json({ error: `Invalid ${key} format` });
            }
          }
        }
      }
    }

    // Sanitize query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          req.query[key] = sanitizeQueryParam(value);
          
          // Validate specific query parameters
          if (['limit', 'page', 'size_min', 'size_max'].includes(key)) {
            const num = validateInteger(value, 1, key === 'limit' ? 100 : Number.MAX_SAFE_INTEGER);
            if (num === null && value !== '') {
              return res.status(400).json({ error: `Invalid ${key} value` });
            }
          }
        }
      }
    }

    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid request parameters' });
  }
};

/**
 * Validate and sanitize request body
 */
export const validateBody = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.body && typeof req.body === 'object') {
      // Sanitize string fields in body
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string') {
          // Don't sanitize password fields
          if (key !== 'password') {
            req.body[key] = sanitizeInput(value);
          }
          
          // Validate specific fields
          if (key === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              return res.status(400).json({ error: 'Invalid email format' });
            }
          }
          
          if (key === 'permission' && value) {
            if (!['view', 'edit', 'owner'].includes(value)) {
              return res.status(400).json({ error: 'Invalid permission value' });
            }
          }
        }
      }
    }

    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid request body' });
  }
};

/**
 * Rate limiting per user
 */
export const userRateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: any, res: Response, next: NextFunction) => {
    const userId = req.userId || req.ip || 'anonymous';
    const now = Date.now();
    const userRequests = requests.get(userId);

    if (!userRequests || now > userRequests.resetTime) {
      requests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userRequests.count >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000)
      });
    }

    userRequests.count++;
    next();
  };
};

/**
 * Validate file upload parameters
 */
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.file) {
      // Additional file validation
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: 'File size exceeds 5MB limit' });
      }

      // Validate file name
      if (!req.file.originalname || req.file.originalname.length > 255) {
        return res.status(400).json({ error: 'Invalid file name' });
      }

      // Check for dangerous file extensions
      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar', '.js', '.vbs', '.ps1'];
      const fileExtension = req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf('.'));
      
      if (dangerousExtensions.includes(fileExtension)) {
        return res.status(400).json({ error: 'File type not allowed for security reasons' });
      }
    }

    next();
  } catch (error) {
    res.status(400).json({ error: 'File validation failed' });
  }
};