import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { randomUUID } from 'crypto';
import { AzureConfig } from '../config/azure.config';

export interface PresignedUrlOptions {
  containerName: string;
  fileName: string;
  contentType: string;
  expiresInMinutes?: number;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  blobUrl: string;
  expiresIn: number;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly blobServiceClient: BlobServiceClient;
  private readonly accountName: string;
  private readonly accountKey: string;
  private readonly defaultContainer: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    const azureConfig = this.configService.get<AzureConfig>('azure');
    this.accountName = azureConfig?.storageAccountName || this.configService.get<string>('AZURE_STORAGE_ACCOUNT_NAME') || '';
    this.accountKey = azureConfig?.storageAccountKey || this.configService.get<string>('AZURE_STORAGE_ACCOUNT_KEY') || '';
    this.defaultContainer = azureConfig?.storageContainer || this.configService.get<string>('AZURE_STORAGE_CONTAINER', 'livex-media');
    this.publicUrl = this.configService.get<string>('AZURE_STORAGE_PUBLIC_URL') || this.configService.get<string>('AZURE_STORAGE_URL') || `https://${this.accountName}.blob.core.windows.net`;

    if (!this.accountName) {
      throw new Error('AZURE_STORAGE_ACCOUNT_NAME is required');
    }

    // Initialize BlobServiceClient
    if (this.accountKey) {
      // Use account key authentication (for development/Azurite)
      const storageUrl = this.configService.get<string>('AZURE_STORAGE_URL') || 
                        `https://${this.accountName}.blob.core.windows.net`;
      
      this.blobServiceClient = new BlobServiceClient(
        storageUrl,
        new StorageSharedKeyCredential(this.accountName, this.accountKey)
      );
    } else {
      // Use DefaultAzureCredential for production (Managed Identity, etc.)
      this.blobServiceClient = new BlobServiceClient(
        `https://${this.accountName}.blob.core.windows.net`,
        new DefaultAzureCredential()
      );
    }

    this.logger.log(`Azure Blob Storage initialized for account: ${this.accountName}`);
  }

  /**
   * Generate a presigned URL for uploading a file to Azure Blob Storage
   */
  async generatePresignedUrl(options: PresignedUrlOptions): Promise<PresignedUrlResult> {
    const {
      containerName = this.defaultContainer,
      fileName,
      contentType,
      expiresInMinutes = 60
    } = options;

    try {
      // Ensure container exists
      await this.ensureContainerExists(containerName);

      // Generate unique blob name
      const blobName = this.generateBlobName(fileName);
      
      // Get container client
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      let uploadUrl: string;
      const blobUrl = blockBlobClient.url;

      if (this.accountKey) {
        // Generate SAS token for upload
        const expiresOn = new Date();
        expiresOn.setMinutes(expiresOn.getMinutes() + expiresInMinutes);

        const sasToken = generateBlobSASQueryParameters({
          containerName,
          blobName,
          permissions: BlobSASPermissions.parse('w'), // Write permission
          expiresOn,
          contentType,
        }, new StorageSharedKeyCredential(this.accountName, this.accountKey));

        uploadUrl = `${blockBlobClient.url}?${sasToken.toString()}`;
      } else {
        // For production with Managed Identity, you might need to implement
        // a different approach or use Azure Functions for SAS generation
        throw new BadRequestException('SAS token generation requires account key');
      }

      this.logger.debug(`Generated presigned URL for blob: ${blobName}`);

      return {
        uploadUrl,
        blobUrl,
        expiresIn: expiresInMinutes * 60, // Return in seconds
      };
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('Failed to generate upload URL');
    }
  }

  /**
   * Upload a file directly to Azure Blob Storage
   */
  async uploadFile(
    containerName: string,
    fileName: string,
    fileBuffer: Buffer,
    contentType: string
  ): Promise<string> {
    try {
      await this.ensureContainerExists(containerName);

      // Use the provided fileName directly (it already contains the full path for professional structure)
      const blobName = fileName;
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.uploadData(fileBuffer, {
        blobHTTPHeaders: {
          blobContentType: contentType,
        },
      });

      this.logger.debug(`Uploaded file: ${blobName}`);
      
      // Return public URL for browser access
      const publicUrl = `${this.publicUrl}/${containerName}/${blobName}`;
      return publicUrl;
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('Failed to upload file');
    }
  }

  /**
   * Delete a blob from Azure Blob Storage
   */
  async deleteFile(containerName: string, blobName: string): Promise<void> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.deleteIfExists();
      this.logger.debug(`Deleted blob: ${blobName}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('Failed to delete file');
    }
  }

  /**
   * Check if a blob exists
   */
  async fileExists(containerName: string, blobName: string): Promise<boolean> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      return await blockBlobClient.exists();
    } catch (error) {
      this.logger.error(`Failed to check file existence: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      return false;
    }
  }

  /**
   * List blobs in a container with optional prefix
   */
  async listFiles(containerName: string, prefix?: string): Promise<string[]> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blobs: string[] = [];

      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        blobs.push(blob.name);
      }

      return blobs;
    } catch (error) {
      this.logger.error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('Failed to list files');
    }
  }

  /**
   * Extract blob name from full URL
   */
  extractBlobNameFromUrl(url: string): string | null {
    try {
      const urlParts = new URL(url);
      const pathParts = urlParts.pathname.split('/');
      // Remove empty first element and container name
      return pathParts.slice(2).join('/');
    } catch {
      this.logger.warn(`Failed to extract blob name from URL: ${url}`);
      return null;
    }
  }

  /**
   * Get file extension from content type
   */
  getFileExtension(contentType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
    };

    return extensions[contentType.toLowerCase()] || 'bin';
  }

  /**
   * Extract file extension from filename
   */
  getFileExtensionFromName(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return extension || 'bin';
  }

  /**
   * Validate file type
   */
  validateFileType(contentType: string, allowedTypes: string[] = []): boolean {
    const defaultAllowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif'
    ];

    const allowedTypesToCheck = allowedTypes.length > 0 ? allowedTypes : defaultAllowedTypes;
    return allowedTypesToCheck.includes(contentType.toLowerCase());
  }

  /**
   * Ensure container exists, create if it doesn't
   */
  private async ensureContainerExists(containerName: string): Promise<ContainerClient> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      
      // Create container if it doesn't exist
      await containerClient.createIfNotExists({
        access: 'blob', // Allow public read access to blobs
      });

      return containerClient;
    } catch (error) {
      this.logger.error(`Failed to ensure container exists: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('Failed to access storage container');
    }
  }

  /**
   * Generate unique blob name with timestamp and UUID (legacy method)
   */
  private generateBlobName(originalFileName: string): string {
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const uuid = randomUUID();
    const extension = originalFileName.split('.').pop() || 'bin';
    
    return `${timestamp}/${uuid}.${extension}`;
  }

  /**
   * Generate slug from text (for professional file naming)
   */
  generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Generate professional blob path for experiences
   */
  generateExperienceBlobPath(
    resortSlug: string,
    experienceSlug: string,
    imageType: 'hero' | 'gallery',
    fileName: string,
    galleryIndex?: number
  ): string {
    const extension = this.getFileExtensionFromName(fileName);
    const uuid = randomUUID();
    
    if (imageType === 'hero') {
      return `experiences/${resortSlug}/${experienceSlug}/hero-${uuid}.${extension}`;
    } else {
      const index = galleryIndex ? galleryIndex.toString().padStart(3, '0') : '001';
      return `experiences/${resortSlug}/${experienceSlug}/gallery/${index}-${uuid}.${extension}`;
    }
  }
}
