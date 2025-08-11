# Manual API Testing Guide for Postman

## 1. User Signup
**POST** `http://localhost:3000/auth/signup`
**Headers:** `Content-Type: application/json`
```json
{
  "email": "test@example.com",
  "password": "password123",
  "name": "Test User"
}
```

## 2. User Login
**POST** `http://localhost:3000/auth/signin`
**Headers:** `Content-Type: application/json`
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```
*Copy the `token` from response for next requests*

## 3. Create Folder
**POST** `http://localhost:3000/api/folders`
**Headers:** `Authorization: Bearer YOUR_TOKEN`
```json
{
  "name": "My Documents"
}
```

## 4. Upload File
**POST** `http://localhost:3000/api/files/upload`
**Headers:** `Authorization: Bearer YOUR_TOKEN`
**Body:** form-data
- Key: `file` (File type) - Select any file
- Key: `folderId` (Text) - Use folder ID from step 3

## 5. List Files
**GET** `http://localhost:3000/api/files`
**Headers:** `Authorization: Bearer YOUR_TOKEN`

## 6. Search Files
**GET** `http://localhost:3000/api/search/files?q=test`
**Headers:** `Authorization: Bearer YOUR_TOKEN`

## 7. Share File
**POST** `http://localhost:3000/api/files/{fileId}/share`
**Headers:** `Authorization: Bearer YOUR_TOKEN`
```json
{
  "email": "friend@example.com",
  "permission": "view"
}
```

Replace `{fileId}` with actual file ID from step 5.