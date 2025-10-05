import { IsNotEmpty, IsString, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';

export enum ImageType {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
  GIF = 'image/gif',
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

export interface PresignedUrlResponse {
  upload_url: string;
  image_url: string;
  expires_in: number;
}

export class DirectUploadDto {
  @IsOptional()
  @IsString()
  container?: string;
}
