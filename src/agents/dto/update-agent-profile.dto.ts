import { IsString, IsOptional } from 'class-validator';

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
}
