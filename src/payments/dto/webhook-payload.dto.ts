import { IsString, IsNotEmpty, IsObject, IsOptional, MaxLength } from 'class-validator';

export class WebhookPayloadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  provider: string;

  @IsObject()
  @IsNotEmpty()
  payload: any;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  signature?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}
