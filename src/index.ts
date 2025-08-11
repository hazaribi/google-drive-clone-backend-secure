import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { supabase } from './config/supabase';
import { SECURITY_CONFIG, validateSecurityConfig } from './config/security';
import authRoutes from './routes/auth';
import fileRoutes from './routes/files';
import folderRoutes from './routes/folders';
import searchRoutes from './routes/search';
import { authenticateUser } from './middleware/auth';
import { validateParams, validateBody } from './middleware/validation';

// Validate security configuration
validateSecurityConfig();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: SECURITY_CONFIG.GLOBAL_RATE_LIMIT.windowMs,
  max: SECURITY_CONFIG.GLOBAL_RATE_LIMIT.max,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ 
  limit: '5mb',
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '5mb',
  parameterLimit: 100
}));

// Input validation middleware
app.use(validateParams);
app.use(validateBody);
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: SECURITY_CONFIG.SESSION_MAX_AGE,
    sameSite: 'strict'
  },
  name: 'sessionId' // Don't use default session name
}));
app.use(passport.initialize());

// CSRF token endpoint
app.get('/csrf-token', (req: Request, res: Response) => {
  try {
    if (!req.session) {
      return res.status(500).json({ error: 'Session not initialized' });
    }
    const token = require('crypto').randomBytes(32).toString('hex');
    req.session.csrfToken = token;
    res.json({ csrfToken: token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
});

// Health check
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Google Drive Clone API', 
    version: '1.0.0',
    status: 'healthy',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/files', fileRoutes); // Some routes are public (shared files)
app.use('/api/folders', folderRoutes);
app.use('/api/search', searchRoutes);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  try {
    // Log error details for debugging (server-side only)
    const sanitizedUrl = req.url ? req.url.replace(/[\r\n]/g, '') : 'unknown';
    const sanitizedMethod = req.method ? req.method.replace(/[\r\n]/g, '') : 'unknown';
    console.error('Error:', {
      message: err.message ? err.message.replace(/[\r\n]/g, ' ') : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      url: sanitizedUrl,
      method: sanitizedMethod,
      timestamp: new Date().toISOString()
    });
  } catch (logError) {
    console.error('Error logging failed:', logError);
  }
  
  // Send sanitized error response
  const statusCode = err.statusCode || 500;
  let message = 'Internal server error';
  
  if (process.env.NODE_ENV === 'development') {
    message = err.message || 'Something went wrong!';
  }
  
  // Remove sensitive information from error messages
  message = message
    .replace(/password/gi, '[REDACTED]')
    .replace(/token/gi, '[REDACTED]')
    .replace(/key/gi, '[REDACTED]')
    .replace(/secret/gi, '[REDACTED]');
    
  res.status(statusCode).json({ 
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});