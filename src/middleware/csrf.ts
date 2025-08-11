import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      csrfToken?: string;
    }
  }
}

/**
 * Generate CSRF token
 */
export const generateCSRFToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * CSRF protection middleware
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF only for safe methods (GET, HEAD, OPTIONS) and specific endpoints
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) && 
      !req.path.includes('/permissions') && 
      !req.path.includes('/share') &&
      !req.path.includes('/download')) {
    return next();
  }
  
  // Skip for health check and CSRF token endpoints
  if (req.path === '/' || req.path === '/health' || req.path === '/csrf-token') {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] as string;
  const authHeader = req.headers.authorization;
  
  // For JWT-authenticated requests, require CSRF token for state-changing operations
  if (authHeader && authHeader.startsWith('Bearer ')) {
    if (!csrfToken) {
      return res.status(403).json({ error: 'CSRF token required for state-changing operations' });
    }
    
    // Validate CSRF token format (64 character hex string)
    if (!/^[a-f0-9]{64}$/.test(csrfToken)) {
      return res.status(403).json({ error: 'Invalid CSRF token format' });
    }
    
    return next();
  }

  // For session-based requests
  const sessionToken = req.session?.csrfToken;
  if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }

  next();
};

/**
 * Endpoint to get CSRF token
 */
export const getCSRFToken = (req: Request, res: Response) => {
  try {
    const token = generateCSRFToken();
    
    if (req.session) {
      req.session.csrfToken = token;
    }
    
    res.json({ csrfToken: token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
};