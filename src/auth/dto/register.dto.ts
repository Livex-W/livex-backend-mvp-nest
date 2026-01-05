import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { USER_ROLES } from '../../common/constants/roles';
import type { UserRole } from '../../common/constants/roles';
import { PASSWORD_REGEX } from '../constants/auth.constants';

// Document types matching the database enum
const DOCUMENT_TYPES = ['CC', 'CE', 'TI', 'PPT', 'NIT', 'PASSPORT', 'FOREIGN_ID'] as const;
type DocumentType = typeof DOCUMENT_TYPES[number];

export class RegisterDto {
    @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
    @IsEmail()
    email!: string;

    @IsOptional()
    @IsString()
    firebaseUid?: string;

    @IsOptional()
    @IsString()
    @Matches(PASSWORD_REGEX, {
        message: 'Password must be at least 8 characters, include uppercase, lowercase, and numbers',
    })
    password?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    fullName?: string;

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

    @IsOptional()
    @IsEnum(USER_ROLES, {
        message: `Role must be one of: ${USER_ROLES.join(', ')}`,
    })
    role?: UserRole;

    @IsOptional()
    @IsString()
    resortId?: string;
}

