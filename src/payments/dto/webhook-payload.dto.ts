import { IsString, IsOptional, IsObject } from 'class-validator';

export class WebhookPayloadDto {
  @IsString()
  provider: string;

  @IsObject()
  payload: any;

  @IsOptional()
  @IsString()
  signature?: string;
}
