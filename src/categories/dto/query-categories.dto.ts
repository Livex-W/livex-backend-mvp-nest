import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryCategoriesDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim().toLowerCase())
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim().toLowerCase())
  slug?: string;
}
