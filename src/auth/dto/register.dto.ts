import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { USER_ROLES } from '../../common/constants/roles';
import type { UserRole } from '../../common/constants/roles';
import { PASSWORD_REGEX } from '../constants/auth.constants';

export class RegisterDto {
    @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
    @IsEmail()
    email!: string;

    @IsString()
    @Matches(PASSWORD_REGEX, {
        message: 'Password must be at least 8 characters, include uppercase, lowercase, and numbers',
    })
    password!: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    fullName?: string;

    @IsOptional()
    @IsEnum(USER_ROLES, {
        message: `Role must be one of: ${USER_ROLES.join(', ')}`,
    })
    role?: UserRole;
}
