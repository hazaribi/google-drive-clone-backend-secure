import validator from 'validator';
import path from 'path';

/**
 * Sanitize user input to prevent XSS attacks
 */
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  // First trim and escape HTML entities
  let sanitized = validator.escape(input.trim());
  
  // Remove potentially dangerous patterns
  sanitized = sanitized
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Script tags
    .replace(/javascript:/gi, '') // JavaScript protocol
    .replace(/vbscript:/gi, '') // VBScript protocol
    .replace(/on\w+\s*=/gi, '') // Event handlers
    .replace(/expression\s*\(/gi, '') // CSS expressions
    .replace(/url\s*\(/gi, '') // CSS url()
    .replace(/import\s+/gi, '') // CSS @import
    .replace(/\\x[0-9a-f]{2}/gi, '') // Hex encoded chars
    .replace(/\\u[0-9a-f]{4}/gi, ''); // Unicode encoded chars
    
  return sanitized;
};

/**
 * Sanitize output for safe HTML rendering
 */
export const sanitizeOutput = (output: any): string => {
  if (!output) return '';
  const str = typeof output === 'string' ? output : String(output);
  
  // Escape HTML entities and remove dangerous patterns
  return validator.escape(str)
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

/**
 * Validate and sanitize file names to prevent path traversal
 */
export const sanitizeFileName = (fileName: string): string => {
  if (!fileName || typeof fileName !== 'string') return '';
  
  // Remove dangerous characters and patterns
  const sanitized = fileName
    .replace(/\.\./g, '') // Path traversal
    .replace(/[\/\\]/g, '') // Path separators
    .replace(/[<>:"|?*\x00-\x1f]/g, '') // Windows reserved chars
    .replace(/^\./g, '') // Hidden files
    .replace(/\.$/, '') // Trailing dots
    .replace(/\s+/g, ' ') // Multiple spaces
    .replace(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i, 'file') // Windows reserved names
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '') // Control characters
    .trim();
    
  // Ensure filename is not empty after sanitization
  const result = sanitized.substring(0, 255);
  return result || 'untitled';
};

/**
 * Validate file path to prevent traversal
 */
export const validateFilePath = (filePath: string): boolean => {
  if (!filePath || typeof filePath !== 'string') return false;
  
  const normalized = path.normalize(filePath);
  
  // Check for path traversal patterns
  const dangerousPatterns = [
    '..',
    '~',
    '/etc/',
    '/var/',
    '/usr/',
    '/bin/',
    '/sbin/',
    'C:\\',
    'D:\\',
    '\\\\',
    '%2e%2e',
    '%252e%252e',
    '..%2f',
    '..%5c'
  ];
  
  const lowerPath = normalized.toLowerCase();
  for (const pattern of dangerousPatterns) {
    if (lowerPath.includes(pattern.toLowerCase())) {
      return false;
    }
  }
  
  return !path.isAbsolute(normalized);
};

/**
 * Validate UUID format
 */
export const isValidUUID = (uuid: string): boolean => {
  if (!uuid || typeof uuid !== 'string') return false;
  return validator.isUUID(uuid);
};

/**
 * Validate integer input
 */
export const validateInteger = (value: any, min = 0, max = Number.MAX_SAFE_INTEGER): number | null => {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < min || num > max) return null;
  return num;
};

/**
 * Sanitize database query parameters
 */
export const sanitizeQueryParam = (param: any): string => {
  if (!param) return '';
  const str = String(param).trim();
  // Remove SQL injection patterns and dangerous characters
  return str
    .replace(/[';"\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/xp_/gi, '')
    .replace(/sp_/gi, '')
    .replace(/union/gi, '')
    .replace(/select/gi, '')
    .replace(/insert/gi, '')
    .replace(/update/gi, '')
    .replace(/delete/gi, '')
    .replace(/drop/gi, '')
    .replace(/create/gi, '')
    .replace(/alter/gi, '')
    .replace(/exec/gi, '')
    .replace(/script/gi, '');
};

/**
 * Sanitize error messages for client response
 */
export const sanitizeErrorMessage = (error: any): string => {
  if (!error) return 'An error occurred';
  
  const message = typeof error === 'string' ? error : error.message || 'An error occurred';
  const sanitized = sanitizeInput(message);
  
  // Remove sensitive information
  return sanitized
    .replace(/password/gi, '[REDACTED]')
    .replace(/token/gi, '[REDACTED]')
    .replace(/key/gi, '[REDACTED]');
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  return validator.isEmail(email) && email.length <= 254;
};

/**
 * Rate limiting key generator
 */
export const generateRateLimitKey = (req: any): string => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userId = req.user?.id || 'anonymous';
  return `${sanitizeInput(ip)}:${sanitizeInput(userId)}`;
};