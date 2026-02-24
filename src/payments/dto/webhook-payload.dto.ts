import { IsString, IsNotEmpty, IsObject, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { EPaymentProvider } from '../providers/payment-provider.factory';

export class WebhookPayloadDto {
  @IsEnum(EPaymentProvider)
  @IsNotEmpty()
  @MaxLength(50)
  provider: EPaymentProvider;

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
