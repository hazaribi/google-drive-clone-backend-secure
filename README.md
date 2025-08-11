# Google Drive Clone Backend

A production-ready backend for Google Drive Clone using Supabase for database and file storage.

## 🚀 Features

- **Authentication**: JWT-based auth with signup/signin
- **File Management**: Upload, download, delete files
- **Folder Management**: Create, rename, delete folders
- **Search**: Search files and folders
- **Security**: Row Level Security (RLS) with Supabase
- **TypeScript**: Full type safety

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── types/           # TypeScript types
│   └── index.ts         # Main server file
├── database.sql         # Database schema
└── package.json
```

## 🛠️ Setup

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Setup Supabase**:
   - Create a new Supabase project
   - Run the SQL from `database.sql` in Supabase SQL Editor
   - Update `.env` with your Supabase credentials

3. **Environment Variables**:
   ```env
   SUPABASE_URL=your-supabase-url
   SUPABASE_ANON_KEY=your-supabase-anon-key
   JWT_SECRET=your-jwt-secret
   PORT=3000
   ```

4. **Run the server**:
   ```bash
   npm run dev
   ```

## 📚 API Endpoints

### Authentication
- `POST /auth/signup` - Create account
- `POST /auth/signin` - Sign in

### Files (Protected)
- `POST /api/files/upload` - Upload file
- `GET /api/files` - Get files
- `DELETE /api/files/:id` - Delete file
- `GET /api/files/search?q=query` - Search files

### Folders (Protected)
- `POST /api/folders` - Create folder
- `GET /api/folders` - Get folders
- `PUT /api/folders/:id` - Rename folder
- `DELETE /api/folders/:id` - Delete folder
- `GET /api/folders/search?q=query` - Search folders

## 🔒 Security Features

- JWT authentication
- Password hashing with bcrypt
- Row Level Security (RLS)
- File size limits
- Input validation
- CORS protection

## 🚀 Production Deployment

1. Build the project: `npm run build`
2. Set production environment variables
3. Deploy to your preferred platform (Vercel, Railway, etc.)