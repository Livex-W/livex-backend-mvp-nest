import { IsString, IsOptional, Matches } from 'class-validator';
import { IsValidNit } from '../../common/validators/is-valid-nit.validator';

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
    @IsValidNit()
    nit?: string;

    @IsOptional()
    @IsString()
    @Matches(/^\d{5}$/, { message: 'RNT must be exactly 5 digits' })
    rnt?: string;
}
