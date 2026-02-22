import { IsString, IsOptional, IsNumber, MinLength, MaxLength, Matches } from 'class-validator';
import { IsValidNit } from '../../common/validators/is-valid-nit.validator';

export class CreateResortDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

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
  @IsValidNit()
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
}
