import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  slotId!: string;

  @IsUUID()
  experienceId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  adults!: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(0)
  children: number = 0;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  subtotalCents!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  taxCents!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency: string = 'COP';

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;

}
