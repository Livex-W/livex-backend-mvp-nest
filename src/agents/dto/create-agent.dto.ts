import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength, IsIn } from 'class-validator';
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
