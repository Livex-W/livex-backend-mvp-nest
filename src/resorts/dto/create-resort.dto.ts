import { IsString, IsOptional, IsEmail, IsNumber, IsBoolean, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateResortDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contact_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address_line?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{9}-\d$/, { message: 'NIT must be in format: 800098813-6' })
  nit?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, { message: 'RNT must be exactly 5 digits' })
  rnt?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
