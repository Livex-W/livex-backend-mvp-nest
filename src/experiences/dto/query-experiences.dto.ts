import { IsOptional, IsEnum, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ExperienceCategory, ExperienceStatus } from './create-experience.dto';

export class QueryExperiencesDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  resort_id?: string;

  @IsOptional()
  @IsEnum(ExperienceCategory)
  category?: ExperienceCategory;

  @IsOptional()
  @IsEnum(ExperienceStatus)
  status?: ExperienceStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_price?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  min_rating?: number;

  @IsOptional()
  @Transform(({ value }): string[] => {
    if (typeof value === 'string') {
      return value.split(',').map(item => item.trim().toUpperCase());
    }
    return Array.isArray(value) ? value as string[] : [];
  })
  currencies?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return value === 'true' || value === true;
  })
  has_images?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return value === 'true' || value === true;
  })
  include_images?: boolean;

  /**
   * Internal flag for management endpoint to show all statuses
   * Not exposed via API, set programmatically
   */
  @IsOptional()
  include_all_statuses?: boolean;
}
