import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, CreateBucketCommand, HeadBucketCommand, BucketLocationConstraint } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { AwsConfig } from '../config/aws.config';
import { CustomLoggerService } from '../common/services/logger.service';

export interface PresignedUrlOptions {
  containerName?: string; // Kept for compatibility, maps to folder prefix or ignored if bucket is global
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
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly customLogger: CustomLoggerService,
  ) {
    const awsConfig = this.configService.get<AwsConfig>('aws');

    // Fallback to env vars if config object is not available (though it should be)
    const accessKeyId = awsConfig?.accessKeyId || this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = awsConfig?.secretAccessKey || this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    this.region = awsConfig?.region || this.configService.get<string>('AWS_REGION', 'us-east-2');
    this.bucketName = awsConfig?.bucketName || this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials are missing. S3 uploads will fail.');
    }

    if (!this.bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME is missing. S3 uploads will fail.');
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });

    this.logger.log(`AWS S3 initialized for bucket: ${this.bucketName} in region: ${this.region}`);

    // Initialize bucket check
    this.ensureContainerExists(this.bucketName).catch(err => {
      this.logger.error(`Failed to initialize bucket: ${err.message}`);
    });
  }

  /**
   * Generate a presigned URL for uploading a file to AWS S3
   */
  async generatePresignedUrl(options: PresignedUrlOptions): Promise<PresignedUrlResult> {
    const {
      fileName,
      contentType,
      expiresInMinutes = 60
    } = options;

    try {
      // Generate a unique key for the file
      const key = this.generateName(fileName);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInMinutes * 60 });

      const customDomain = this.configService.get<string>('AWS_S3_CUSTOM_DOMAIN');
      let blobUrl = '';

      if (customDomain) {
        const domain = customDomain.replace(/\/$/, '');
        blobUrl = `${domain}/${key}`;
      } else {
        blobUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
      }

      this.logger.debug(`Generated presigned URL for key: ${key}`);

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
   * Upload a file directly to AWS S3
   */
  async uploadFile(
    containerName: string, // Ignored in S3 implementation (or could be used as folder prefix if needed)
    fileName: string,
    fileBuffer: Buffer,
    contentType: string
  ): Promise<string> {
    try {
      const key = fileName;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      this.logger.debug(`Uploaded file: ${key}`);

      // Return public URL using custom domain or standard S3 structure
      const customDomain = this.configService.get<string>('AWS_S3_CUSTOM_DOMAIN');
      let publicUrl = '';

      if (customDomain) {
        // Ensure no trailing slash
        const domain = customDomain.replace(/\/$/, '');
        publicUrl = `${domain}/${key}`;
      } else {
        publicUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
      }

      // Log business event with structured logging
      this.customLogger.logBusinessEvent('file_uploaded', {
        bucketName: this.bucketName,
        fileName: key,
        contentType,
        fileSize: fileBuffer.length,
        publicUrl
      });

      return publicUrl;
    } catch (error) {
      // Log error with structured logging
      this.customLogger.logError(error as Error, {
        bucketName: this.bucketName,
        fileName,
        contentType,
        fileSize: fileBuffer.length,
        action: 'upload_file'
      });

      this.logger.error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('Failed to upload file');
    }
  }

  /**
   * Delete a file from AWS S3
   */
  async deleteFile(containerName: string, blobName: string): Promise<void> {
    try {
      // In Azure the blobName was passed directly. 
      // If blobName is the full key (which it seems to be based on extractBlobNameFromUrl logic previously), use it.
      const key = blobName;

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.debug(`Deleted file: ${key}`);

      // Log business event with structured logging
      this.customLogger.logBusinessEvent('file_deleted', {
        bucketName: this.bucketName,
        fileName: key
      });
    } catch (error) {
      // Log error with structured logging
      this.customLogger.logError(error as Error, {
        bucketName: this.bucketName,
        fileName: blobName,
        action: 'delete_file'
      });

      this.logger.error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('Failed to delete file');
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(containerName: string, blobName: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: blobName,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      // Method fails with 404 if object does not exist
      this.logger.error(`Failed to check file existence: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      return false;
    }
  }

  /**
   * List files in a bucket with optional prefix
   */
  async listFiles(containerName: string, prefix?: string): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);
      return response.Contents?.map(item => item.Key || '') || [];
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
      const urlObj = new URL(url);
      // AWS S3 URL format: https://bucket.s3.region.amazonaws.com/key
      // Pathname starts with /, so we remove it.
      return urlObj.pathname.substring(1);
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
   * Initial check for bucket existence (optional in S3 usage as buckets are static)
   */
  private async ensureContainerExists(containerName: string): Promise<void> {
    try {
      const command = new HeadBucketCommand({
        Bucket: containerName,
      });
      await this.s3Client.send(command);
      this.logger.debug(`Bucket ${containerName} exists.`);
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        this.logger.warn(`Bucket ${containerName} not found. Attempting to create...`);
        try {
          const createCommand = new CreateBucketCommand({
            Bucket: containerName,
            CreateBucketConfiguration: {
              LocationConstraint: this.region !== 'us-east-1' ? (this.region as BucketLocationConstraint) : undefined,
            },
          });
          await this.s3Client.send(createCommand);
          this.logger.log(`Bucket ${containerName} created successfully.`);
        } catch (createError: any) {
          this.logger.error(`Failed to create bucket: ${createError.message}`);
          throw new BadRequestException('Failed to create S3 bucket');
        }
      } else {
        this.logger.error(`Error checking bucket existence: ${error.message}`);
      }
    }
  }


  /**
 * Generate unique name with timestamp and UUID (legacy method)
 */
  private generateName(originalFileName: string): string {
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const uuid = randomUUID();
    const extension = originalFileName.split('.').pop() || 'bin';

    return `${timestamp}/${uuid}.${extension}`;
  }

  /**
   * Generate slug from text
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
