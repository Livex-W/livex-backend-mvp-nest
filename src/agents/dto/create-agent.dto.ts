import { IsEmail, IsOptional, IsString, IsUUID, MinLength, IsIn, Matches } from 'class-validator';
import { IsValidNit } from '../../common/validators/is-valid-nit.validator';

export class CreateAgentDto {
    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(2)
    fullName!: string;

    @IsString()
    @MinLength(6)
    password!: string;

    @IsString()
    phone!: string;

    @IsString()
    @IsIn(['CC', 'NIT', 'CE', 'PASSPORT'])
    documentType!: string;

    @IsString()
    @MinLength(5)
    documentNumber!: string;

    @IsOptional()
    @IsString()
    @IsValidNit()
    nit?: string;

    @IsOptional()
    @IsString()
    @Matches(/^\d{5}$/, { message: 'RNT must be exactly 5 digits' })
    rnt?: string;

    @IsOptional()
    @IsUUID()
    resortId?: string | null;
}

