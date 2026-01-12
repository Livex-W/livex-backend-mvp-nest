import { IsNotEmpty, IsString, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';

export enum ImageType {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
  GIF = 'image/gif',
}

// Document types that include both images and PDFs (for legal documents)
export enum DocumentType {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
  GIF = 'image/gif',
  PDF = 'application/pdf',
}

export class PresignImageDto {
  @IsNotEmpty()
  @IsString()
  filename: string;

  @IsNotEmpty()
  @IsEnum(ImageType)
  content_type: ImageType;

  @IsOptional()
  @IsString()
  container?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440) // Max 24 hours
  expires_in_minutes?: number = 60;
}

// DTO for document uploads (includes PDF support)
export class PresignDocumentDto {
  @IsNotEmpty()
  @IsString()
  filename: string;

  @IsNotEmpty()
  @IsEnum(DocumentType)
  content_type: DocumentType;

  @IsOptional()
  @IsString()
  container?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440) // Max 24 hours
  expires_in_minutes?: number = 60;
}

export interface PresignedUrlResponse {
  upload_url: string;
  image_url?: string;
  document_url?: string;
  expires_in: number;
}

export class DirectUploadDto {
  @IsOptional()
  @IsString()
  container?: string;
}
