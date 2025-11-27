import { IsString, IsOptional, IsInt, IsIn, Min, Max, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReferralCodeDto {
    @IsString()
    code!: string;

    @IsOptional()
    @IsIn(['commission', 'discount', 'both'])
    codeType?: string;

    @IsOptional()
    @IsIn(['percentage', 'fixed', 'none'])
    discountType?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    discountValue?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(10000)
    commissionOverrideBps?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    usageLimit?: number;

    @IsOptional()
    @IsDateString()
    expiresAt?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    allowStacking?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    minPurchaseCents?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    maxDiscountCents?: number;
}
