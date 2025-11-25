import { IsUUID, IsOptional, IsString, IsPositive, IsInt } from 'class-validator';

export class CreateRefundDto {
  @IsUUID()
  paymentId: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  amountCents?: number; // Si no se especifica, se hace refund completo

  @IsOptional()
  @IsString()
  reason?: string;
}
