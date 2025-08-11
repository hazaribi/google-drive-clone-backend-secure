/**
 * Security configuration constants
 */
export const SECURITY_CONFIG = {
  // File upload limits
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILES_PER_UPLOAD: 1,
  
  // Rate limiting
  GLOBAL_RATE_LIMIT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // requests per window
  },
  
  USER_RATE_LIMIT: {
    windowMs: 60 * 1000, // 1 minute
    max: 10 // requests per window for uploads
  },
  
  // Pagination limits
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE_SIZE: 20,
  
  // String length limits
  MAX_FILENAME_LENGTH: 255,
  MAX_FOLDER_NAME_LENGTH: 255,
  MAX_SEARCH_QUERY_LENGTH: 100,
  
  // Allowed file types
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed'
  ],
  
  // Dangerous file extensions
  DANGEROUS_EXTENSIONS: [
    '.exe', '.bat', '.cmd', '.scr', '.pif', '.com', 
    '.jar', '.js', '.vbs', '.ps1', '.sh', '.php'
  ],
  
  // JWT settings
  JWT_EXPIRY: '7d',
  
  // Session settings
  SESSION_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  
  // CSRF token settings
  CSRF_TOKEN_LENGTH: 64, // hex characters
  
  // Database query limits
  MAX_QUERY_RESULTS: 1000,
  
  // Security headers
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
};

/**
 * Validate security configuration on startup
 */
export const validateSecurityConfig = (): void => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'SESSION_SECRET',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ];
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate JWT secret length
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  
  // Validate session secret length
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long');
  }
  
  console.log('✅ Security configuration validated successfully');
};