import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
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

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsUUID()
    resortId?: string | null;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(10000)
    commissionBps?: number;
}
