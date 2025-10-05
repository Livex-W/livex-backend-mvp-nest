import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }: { value: string }): string => value?.trim())
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  @Transform(({ value }: { value?: string }): string => value?.trim().toLowerCase() ?? "")
  slug?: string;
}
