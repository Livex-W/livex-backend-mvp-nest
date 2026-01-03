import { IsUUID, IsEnum, IsOptional, IsString, IsUrl, IsEmail, IsArray, IsObject } from 'class-validator';
import { PaymentProviderEnum } from '../providers/payment-provider.factory';
import type { WompiMetadata } from '../interfaces/payment-metadata.interfaces';

export class CreatePaymentDto {
  @IsUUID()
  bookingId: string;

  @IsEnum(PaymentProviderEnum)
  provider: PaymentProviderEnum;

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

  @IsOptional()
  @IsString()
  referralCode?: string;

  // Metadata específica para Wompi
  @IsOptional()
  @IsObject()
  wompiMetadata?: WompiMetadata;
}
