import { IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryAvailabilityDto {
  @IsOptional()
  @IsDateString()
  from?: string; // YYYY-MM-DD format

  @IsOptional()
  @IsDateString()
  to?: string; // YYYY-MM-DD format

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30; // Limit days returned

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string))
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  include_full_slots?: boolean = false; // Include slots with 0 remaining capacity
}
