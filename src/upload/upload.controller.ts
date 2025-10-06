import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService, PresignedUrlOptions, PresignedUrlResult } from './upload.service';
import { PresignImageDto, PresignedUrlResponse } from './dto/upload.dto';

@Controller('api/v1/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Generate presigned URL for file upload
   */
  @Post('presign')
  @HttpCode(HttpStatus.CREATED)
  async generatePresignedUrl(@Body() presignDto: PresignImageDto): Promise<PresignedUrlResponse> {
    // Validate file type
    if (!this.uploadService.validateFileType(presignDto.content_type)) {
      throw new BadRequestException('Invalid file type. Only images are allowed.');
    }

    const options: PresignedUrlOptions = {
      containerName: presignDto.container || 'livex-media',
      fileName: presignDto.filename,
      contentType: presignDto.content_type,
      expiresInMinutes: presignDto.expires_in_minutes || 60,
    };

    const result: PresignedUrlResult = await this.uploadService.generatePresignedUrl(options);

    return {
      upload_url: result.uploadUrl,
      image_url: result.blobUrl,
      expires_in: result.expiresIn,
    };
  }

  /**
   * Direct file upload (alternative to presigned URL)
   */
  @Post('direct')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: any,
    @Body('container') container?: string,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    if (!this.uploadService.validateFileType(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only images are allowed.');
    }

    const containerName = container || 'livex-media';
    const url = await this.uploadService.uploadFile(
      containerName,
      file.originalname,
      file.buffer,
      file.mimetype,
    );

    return { url };
  }

  /**
   * Delete a file
   */
  @Delete(':container/:blobName')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @Param('container') container: string,
    @Param('blobName') blobName: string,
  ): Promise<void> {
    await this.uploadService.deleteFile(container, blobName);
  }

  /**
   * List files in container
   */
  @Get(':container/files')
  async listFiles(
    @Param('container') container: string,
    @Query('prefix') prefix?: string,
  ): Promise<{ files: string[] }> {
    const files = await this.uploadService.listFiles(container, prefix);
    return { files };
  }

  /**
   * Check if file exists
   */
  @Get(':container/:blobName/exists')
  async fileExists(
    @Param('container') container: string,
    @Param('blobName') blobName: string,
  ): Promise<{ exists: boolean }> {
    const exists = await this.uploadService.fileExists(container, blobName);
    return { exists };
  }
}
