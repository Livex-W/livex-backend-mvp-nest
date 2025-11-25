import { IsUUID, IsEnum, IsOptional, IsString, IsUrl, IsEmail } from 'class-validator';
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
}
