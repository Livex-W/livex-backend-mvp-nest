import { IsUUID, IsEnum, IsOptional, IsString, IsEmail, IsArray, IsObject } from 'class-validator';
import { EPaymentProvider } from '../providers/payment-provider.factory';
import type { WompiMetadata } from '../interfaces/payment-metadata.interfaces';

export class CreatePaymentDto {
  @IsUUID()
  bookingId: string;

  @IsEnum(EPaymentProvider)
  provider: EPaymentProvider;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
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
