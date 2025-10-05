import { 
  IsNotEmpty, 
  IsOptional, 
  IsString, 
  IsUUID, 
  IsEnum, 
  IsPositive, 
  IsUrl, 
  MaxLength, 
  MinLength,
  IsInt,
  Min
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum ExperienceCategory {
  ISLANDS = 'islands',
  NAUTICAL = 'nautical',
  CITY_TOUR = 'city_tour',
}

export enum ExperienceStatus {
  DRAFT = 'draft',
  UNDER_REVIEW = 'under_review',
  ACTIVE = 'active',
  REJECTED = 'rejected',
}

export class CreateExperienceDto {
  @IsNotEmpty()
  @IsUUID()
  resort_id: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsNotEmpty()
  @IsEnum(ExperienceCategory)
  category: ExperienceCategory;

  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  @Min(1)
  price_cents: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  @Transform(({ value }) => value?.toUpperCase())
  currency?: string = 'COP';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  includes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  excludes?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  main_image_url?: string;

  @IsOptional()
  @IsEnum(ExperienceStatus)
  status?: ExperienceStatus = ExperienceStatus.UNDER_REVIEW;
}
