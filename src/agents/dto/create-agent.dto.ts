import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength, IsIn, Matches } from 'class-validator';
import { Type } from 'class-transformer';

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
    @Matches(/^\d{9}-\d$/, { message: 'NIT must be in format: 800098813-6' })
    nit?: string;

    @IsOptional()
    @IsString()
    @Matches(/^\d{5}$/, { message: 'RNT must be exactly 5 digits' })
    rnt?: string;

    @IsOptional()
    @IsUUID()
    resortId?: string | null;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(10000)
    commissionBps?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    commissionFixedCents?: number;
}
