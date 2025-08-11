# 🧪 Google Drive Clone - API Testing Guide

## 📋 Prerequisites

1. **Start the server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Setup database:**
   - Run SQL from `database.sql` in Supabase SQL Editor

3. **Import Postman Collection:**
   - Import `Google-Drive-Clone-Complete-API-Tests.postman_collection.json`

## 🔄 Testing Flow

### 1. **Authentication Tests**
```
✅ Health Check → GET /
✅ Signup → POST /auth/signup (saves token)
✅ Login → POST /auth/signin (saves token)  
✅ Logout → POST /auth/logout
```

### 2. **Folder Management**
```
✅ Create Folder → POST /api/folders (saves folderId)
✅ Get Folders → GET /api/folders?limit=20&page=1
✅ Rename Folder → PUT /api/folders/{id}
✅ Share Folder → POST /api/folders/{id}/permissions
✅ Delete Folder → DELETE /api/folders/{id}
✅ Get Trash → GET /api/folders/trash
✅ Restore Folder → POST /api/folders/{id}/restore
```

### 3. **File Management**
```
✅ Upload File → POST /api/files/upload (saves fileId)
✅ Get Files → GET /api/files?limit=20&page=1
✅ Rename File → PUT /api/files/{id}
✅ Generate Share Link → POST /api/files/{id}/share
✅ Share with User → POST /api/files/{id}/permissions
✅ Get Permissions → GET /api/files/{id}/permissions
✅ Get Download URL → GET /api/files/{id}/download
✅ Access Shared File → GET /api/files/shared/{token}
✅ Delete File → DELETE /api/files/{id}
✅ Get Trash → GET /api/files/trash
✅ Restore File → POST /api/files/{id}/restore
✅ Permanent Delete → DELETE /api/files/{id}/permanent
```

### 4. **Search & Discovery**
```
✅ Search All → GET /api/search?q=test&limit=20&page=1
✅ Search Files → GET /api/search?q=document&type=files
✅ Advanced Search → GET /api/search/advanced?q=report&format=pdf
```

## 🎯 Key Test Scenarios

### **Authentication Flow**
1. Signup with new user
2. Login with credentials
3. Use token for protected routes
4. Logout to invalidate session

### **File Upload & Management**
1. Upload file to root folder
2. Upload file to specific folder
3. Rename and organize files
4. Test file permissions

### **Sharing & Permissions**
1. Generate public share links
2. Share with specific users
3. Test permission levels (view/edit/owner)
4. Access shared content without auth

### **Trash & Recovery**
1. Soft delete files/folders
2. View trash contents
3. Restore deleted items
4. Permanent deletion

### **Search Functionality**
1. Full-text search across files/folders
2. Filter by file type and size
3. Test pagination in search results

## 🔧 Environment Variables

Set these in Postman environment:
```
baseUrl: http://localhost:3000
token: (auto-set by login)
userId: (auto-set by login)
fileId: (auto-set by upload)
folderId: (auto-set by folder creation)
shareToken: (auto-set by share generation)
```

## ✅ Expected Results

**All endpoints should return:**
- ✅ Proper HTTP status codes
- ✅ JSON responses with consistent structure
- ✅ Pagination metadata where applicable
- ✅ Error messages for invalid requests

**Security checks:**
- ✅ Protected routes require valid JWT
- ✅ Users can only access their own data
- ✅ Permission system works correctly
- ✅ Shared links work without authentication

## 🚀 Quick Test Commands

```bash
# Health check
curl http://localhost:3000

# Signup
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Get files (replace TOKEN)
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/files?limit=20&page=1
```

Your backend is **production-ready** for testing! 🎉