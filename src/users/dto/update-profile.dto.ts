import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

const DOCUMENT_TYPES = ['CC', 'CE', 'TI', 'PPT', 'NIT', 'PASSPORT', 'FOREIGN_ID'] as const;
type DocumentType = typeof DOCUMENT_TYPES[number];

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @Transform(({ value }: { value: string | undefined }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email?: string | undefined;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsEnum(DOCUMENT_TYPES, {
    message: `Document type must be one of: ${DOCUMENT_TYPES.join(', ')}`,
  })
  documentType?: DocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentNumber?: string;
}

