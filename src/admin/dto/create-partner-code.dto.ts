import { IsString, IsNumber, IsOptional, IsIn, IsBoolean, Min } from 'class-validator';

export class CreatePartnerCodeDto {
    @IsString({ message: 'El código es obligatorio' })
    code: string;

    @IsIn(['percentage', 'fixed'], { message: 'Tipo de comisión debe ser percentage o fixed' })
    commissionType: 'percentage' | 'fixed';

    @IsNumber({}, { message: 'El valor de comisión es obligatorio' })
    @Min(0, { message: 'El valor debe ser positivo' })
    commissionValue: number;

    @IsOptional()
    @IsIn(['discount', 'commission', 'both'])
    codeType?: 'discount' | 'commission' | 'both';

    @IsOptional()
    @IsIn(['percentage', 'fixed'])
    discountType?: 'percentage' | 'fixed';

    @IsOptional()
    @IsNumber()
    @Min(0)
    discountValue?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    usageLimit?: number;

    @IsOptional()
    @IsString()
    expiresAt?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
