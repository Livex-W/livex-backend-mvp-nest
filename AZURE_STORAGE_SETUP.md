# Azure Blob Storage Integration

This document explains how to set up and use Azure Blob Storage for file uploads in the LIVEX backend.

## Overview

The system provides a comprehensive file upload solution using Azure Blob Storage with presigned URLs for secure, direct client-to-storage uploads. This approach reduces server load and provides better performance for file uploads.

## Features

- **Presigned URL Generation**: Generate secure, time-limited URLs for direct uploads to Azure Blob Storage
- **File Type Validation**: Automatic validation of file types (images only by default)
- **Automatic Container Management**: Containers are created automatically if they don't exist
- **Direct Upload Support**: Alternative direct upload through the API server
- **File Management**: Delete, list, and check file existence
- **Environment Flexibility**: Works with both Azurite (local development) and Azure Storage (production)

## Architecture

```
Client → API Server → Azure Blob Storage
   ↓         ↓              ↓
Upload   Generate       Store File
Request  Presigned URL   Directly
```

## Setup

### 1. Environment Configuration

#### Development (with Azurite)
```bash
# .env.development
AZURE_STORAGE_ACCOUNT_NAME=devstoreaccount1
AZURE_STORAGE_ACCOUNT_KEY=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
AZURE_STORAGE_CONTAINER=livex-media
AZURE_STORAGE_URL=http://azurite:10000/devstoreaccount1
```

#### Production
```bash
# .env.production
AZURE_STORAGE_ACCOUNT_NAME=your_azure_storage_account
AZURE_STORAGE_ACCOUNT_KEY=your_azure_storage_key
AZURE_STORAGE_CONTAINER=livex-media
# Leave empty for production - uses default Azure endpoints
AZURE_STORAGE_URL=
```

### 2. Docker Setup (Development)

Add Azurite to your `docker-compose.yml`:

```yaml
services:
  azurite:
    image: mcr.microsoft.com/azure-storage/azurite
    ports:
      - "10000:10000"
      - "10001:10001"
      - "10002:10002"
    volumes:
      - azurite_data:/data
    command: "azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0"

volumes:
  azurite_data:
```

## API Endpoints

### Experience Image Upload

#### Generate Presigned URL for Experience Image
```http
POST /v1/experiences/:id/images/presign
Content-Type: application/json

{
  "filename": "beach-sunset.jpg",
  "content_type": "image/jpeg",
  "sort_order": 1
}
```

**Response:**
```json
{
  "upload_url": "https://storage.blob.core.windows.net/livex-media/experiences/uuid/file.jpg?sv=2021-12-02&ss=b&srt=o&sp=w&se=2024-01-01T12:00:00Z&st=2024-01-01T11:00:00Z&spr=https&sig=...",
  "image_url": "https://storage.blob.core.windows.net/livex-media/experiences/uuid/file.jpg",
  "expires_in": 3600
}
```

#### Delete Experience Image
```http
DELETE /v1/experiences/:id/images/:imageId
```

### General Upload Endpoints

#### Generate Presigned URL
```http
POST /v1/upload/presign
Content-Type: application/json

{
  "filename": "document.pdf",
  "content_type": "application/pdf",
  "container": "documents",
  "expires_in_minutes": 60
}
```

#### Direct Upload
```http
POST /v1/upload/direct
Content-Type: multipart/form-data

file: [binary data]
container: "documents" (optional)
```

#### Delete File
```http
DELETE /v1/upload/:container/:blobName
```

#### List Files
```http
GET /v1/upload/:container/files?prefix=experiences/
```

#### Check File Existence
```http
GET /v1/upload/:container/:blobName/exists
```

## Client-Side Upload Flow

### 1. Request Presigned URL
```javascript
const response = await fetch('/v1/experiences/123/images/presign', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify({
    filename: 'beach-photo.jpg',
    content_type: 'image/jpeg',
    sort_order: 1
  })
});

const { upload_url, image_url } = await response.json();
```

### 2. Upload File Directly to Azure
```javascript
const fileInput = document.getElementById('file-input');
const file = fileInput.files[0];

await fetch(upload_url, {
  method: 'PUT',
  headers: {
    'x-ms-blob-type': 'BlockBlob',
    'Content-Type': file.type
  },
  body: file
});

// File is now available at image_url
```

## File Organization

Files are organized in the following structure:
```
livex-media/
├── experiences/
│   ├── {experience-id}/
│   │   ├── {uuid}.jpg
│   │   └── {uuid}.png
├── users/
│   ├── {user-id}/
│   │   └── avatar.jpg
└── documents/
    ├── kyc/
    │   └── {document-id}.pdf
    └── contracts/
        └── {contract-id}.pdf
```

## Security Features

- **Time-Limited URLs**: Presigned URLs expire after a configurable time (default: 1 hour)
- **File Type Validation**: Only allowed file types can be uploaded
- **Container Isolation**: Different containers for different types of content
- **Access Control**: Presigned URL generation requires authentication

## Supported File Types

By default, the following image types are supported:
- `image/jpeg`
- `image/png` 
- `image/webp`
- `image/gif`

To add more file types, update the `validateFileType` method in `UploadService`.

## Error Handling

The system provides comprehensive error handling:

- **400 Bad Request**: Invalid file type, missing parameters
- **404 Not Found**: Experience or image not found
- **500 Internal Server Error**: Azure storage connection issues

## Monitoring and Logging

All upload operations are logged with:
- Request IDs for tracing
- File names and sizes
- Success/failure status
- Error details

## Production Considerations

### Authentication Options

1. **Account Key** (Development/Simple setups)
   - Set `AZURE_STORAGE_ACCOUNT_KEY`
   - Works with Azurite

2. **Managed Identity** (Recommended for production)
   - Remove `AZURE_STORAGE_ACCOUNT_KEY`
   - Configure Azure Managed Identity
   - Automatic credential handling

### Performance Optimization

- Use CDN for serving uploaded files
- Implement image resizing/optimization
- Consider blob lifecycle policies for cost optimization

### Security Best Practices

- Use HTTPS only in production
- Implement rate limiting on upload endpoints
- Monitor for abuse patterns
- Regular key rotation (if using account keys)

## Troubleshooting

### Common Issues

1. **"AZURE_STORAGE_ACCOUNT_NAME is required"**
   - Ensure environment variables are set correctly
   - Check `.env` file is loaded

2. **"Failed to generate upload URL"**
   - Verify Azure credentials
   - Check network connectivity to Azure
   - Ensure container permissions

3. **"Invalid file type"**
   - Check file MIME type
   - Update allowed types in `UploadService`

### Development with Azurite

1. Start Azurite container
2. Verify connection: `http://localhost:10000/devstoreaccount1`
3. Use Azure Storage Explorer for debugging

## Testing

Run the upload functionality tests:
```bash
npm test -- upload.service.spec.ts
npm test -- experiences.controller.spec.ts
```

## Migration from Mock Implementation

The system replaces the previous mock implementation with real Azure Blob Storage. Existing database records with mock URLs will continue to work, but new uploads will use real Azure URLs.
