import { IsString, IsOptional, Matches } from 'class-validator';

export class UpdateAgentProfileDto {
    @IsOptional()
    @IsString()
    bankName?: string;

    @IsOptional()
    @IsString()
    accountNumber?: string;

    @IsOptional()
    @IsString()
    accountType?: string;

    @IsOptional()
    @IsString()
    accountHolderName?: string;

    @IsOptional()
    @IsString()
    taxId?: string;

    @IsOptional()
    @IsString()
    @Matches(/^\d{9}-\d$/, { message: 'NIT must be in format: 800098813-6' })
    nit?: string;

    @IsOptional()
    @IsString()
    @Matches(/^\d{5}$/, { message: 'RNT must be exactly 5 digits' })
    rnt?: string;
}
