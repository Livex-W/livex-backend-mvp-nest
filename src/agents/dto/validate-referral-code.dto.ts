import { IsString, IsOptional } from 'class-validator';

export class ValidateReferralCodeDto {
    @IsString()
    code!: string;

    @IsOptional()
    @IsString()
    experienceId?: string; // Para validaciones futuras por experiencia
}
