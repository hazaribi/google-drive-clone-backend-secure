# Railway Deployment Guide

## Pre-deployment Checklist

### 1. Security Issues to Address
- **CRITICAL**: Multiple XSS vulnerabilities detected in error responses
- **CRITICAL**: CSRF protection is disabled - implement CSRF tokens
- **HIGH**: Log injection vulnerability in error handling
- **HIGH**: Path traversal vulnerability in file operations
- **MEDIUM**: Improve error handling with specific error types

### 2. Environment Variables Setup
Set these environment variables in Railway:

```
SUPABASE_URL=<your_supabase_url>
SUPABASE_ANON_KEY=<your_supabase_anon_key>
JWT_SECRET=<your_strong_jwt_secret_min_32_chars>
SESSION_SECRET=<your_strong_session_secret>
GOOGLE_CLIENT_ID=<your_google_client_id>
GOOGLE_CLIENT_SECRET=<your_google_client_secret>
CLIENT_URL=https://<your-frontend-domain>.com
NODE_ENV=production
```

### 3. Deployment Steps

1. **Connect Repository to Railway**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Initialize project
   railway init
   ```

2. **Set Environment Variables**
   ```bash
   # Set each variable
   railway variables set SUPABASE_URL=<your_value>
   railway variables set SUPABASE_ANON_KEY=<your_value>
   # ... repeat for all variables
   ```

3. **Deploy**
   ```bash
   railway up
   ```

### 4. Post-deployment Verification

1. Check health endpoint: `https://your-app.railway.app/`
2. Test authentication endpoints
3. Verify file upload functionality
4. Check database connections

### 5. Security Recommendations

1. **Implement Input Sanitization**
   - Add input validation middleware
   - Sanitize all user inputs before database operations
   - Escape HTML in error responses

2. **Add CSRF Protection**
   ```bash
   npm install csurf
   ```

3. **Implement Rate Limiting**
   ```bash
   npm install express-rate-limit
   ```

4. **Add Request Logging**
   ```bash
   npm install morgan
   ```

### 6. Monitoring

- Set up Railway's built-in monitoring
- Monitor application logs
- Set up health check alerts
- Monitor database performance

### 7. Scaling Considerations

- Railway auto-scales based on traffic
- Monitor memory usage (current limit: 512MB default)
- Consider database connection pooling for high traffic

## Troubleshooting

### Common Issues:
1. **Build Failures**: Check TypeScript compilation errors
2. **Environment Variables**: Ensure all required vars are set
3. **Database Connection**: Verify Supabase credentials
4. **CORS Issues**: Update CLIENT_URL for your frontend domain

### Logs:
```bash
railway logs
```