import { Transform, Type } from 'class-transformer';
import { IsOptional, IsPositive, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Transform(({ value }): string => {
    if (typeof value === 'string') {
      return value.toLowerCase().trim();
    }
    return value;
  })
  search?: string;

  @IsOptional()
  @Transform(({ value }): string[] => {
    if (typeof value === 'string') {
      return value.split(',').map(item => item.trim());
    }
    return Array.isArray(value) ? value : [];
  })
  sort?: string[];

  get offset(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 10);
  }
}
