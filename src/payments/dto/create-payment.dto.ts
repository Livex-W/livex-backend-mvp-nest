import { IsUUID, IsEnum, IsOptional, IsString, IsUrl, IsEmail, IsArray } from 'class-validator';
import type { PaymentProviderType } from '../providers/payment-provider.factory';

export class CreatePaymentDto {
  @IsUUID()
  bookingId: string;

  @IsEnum(['wompi', 'epayco', 'stripe', 'paypal'])
  provider: PaymentProviderType;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsUrl()
  redirectUrl?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  couponCodes?: string[];
}
