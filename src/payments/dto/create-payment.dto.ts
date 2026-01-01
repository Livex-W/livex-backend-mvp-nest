import { IsUUID, IsEnum, IsOptional, IsString, IsUrl, IsEmail, IsArray, IsObject } from 'class-validator';
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

  @IsOptional()
  @IsString()
  referralCode?: string;

  // Metadata específica para Wompi
  @IsOptional()
  @IsObject()
  wompiMetadata?: {
    // Para NEQUI
    phoneNumber?: string;

    // Para PSE
    userType?: 'PERSON' | 'BUSINESS' | '0' | '1';
    userLegalId?: string;
    userLegalIdType?: 'CC' | 'CE' | 'NIT' | 'PP' | 'TI' | 'DNI';
    financialInstitutionCode?: string;
    paymentDescription?: string;

    // Para CARD
    paymentSourceId?: string;
    installments?: number;
  };
}
