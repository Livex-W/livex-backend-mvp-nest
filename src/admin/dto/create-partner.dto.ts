import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';

export class CreatePartnerDto {
    @IsEmail({}, { message: 'Debe ser un email válido' })
    email: string;

    @IsString()
    @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    password: string;

    @IsString()
    @MinLength(2, { message: 'El nombre es obligatorio' })
    fullName: string;

    @IsOptional()
    @IsString()
    @Matches(/^\+?[1-9]\d{6,14}$/, { message: 'Formato de teléfono inválido' })
    phone?: string;
}
