import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,

  MaxLength,
  MinLength,
  IsInt,
  Min,
  IsBoolean
} from 'class-validator';

import { Transform } from 'class-transformer';

export enum ExperienceCategory {
  ISLANDS = 'islands',
  NAUTICAL = 'nautical',
  CITY_TOUR = 'city_tour',
  SUN_BEACH = 'sun_beach',
  CULTURAL = 'cultural',
  GASTRONOMIC = 'gastronomic',
  ADVENTURE = 'adventure',
  RELIGIOUS = 'religious',
  EDUCATIONAL = 'educational',
  ECOTOURISM = 'ecotourism',
  AGROTOURISM = 'agrotourism',
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



  @IsOptional()
  @IsInt()
  @Min(0)
  child_min_age?: number = 3;

  @IsOptional()
  @IsInt()
  @Min(0)
  child_max_age?: number = 9;

  @IsOptional()
  @IsBoolean()
  allows_children?: boolean = true;

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
  @IsEnum(ExperienceStatus)
  status?: ExperienceStatus = ExperienceStatus.UNDER_REVIEW;
}

