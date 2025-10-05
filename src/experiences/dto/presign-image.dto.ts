import { IsNotEmpty, IsString, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';

export enum ImageType {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
}

export class PresignImageDto {
  @IsNotEmpty()
  @IsString()
  filename: string;

  @IsNotEmpty()
  @IsEnum(ImageType)
  content_type: ImageType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sort_order?: number = 0;
}

export interface PresignedUrlResponse {
  upload_url: string;
  image_url: string;
  expires_in: number;
}
