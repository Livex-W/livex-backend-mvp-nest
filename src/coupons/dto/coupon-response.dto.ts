import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

export class UserCouponResponseDto {
    @IsUUID()
    id: string;

    @IsString()
    code: string;

    @IsEnum(['user_earned', 'vip_subscription', 'promotional'])
    couponType: 'user_earned' | 'vip_subscription' | 'promotional';

    @IsString()
    description: string;

    @IsEnum(['percentage', 'fixed'])
    discountType: 'percentage' | 'fixed';

    @IsInt()
    @Min(0)
    discountValue: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    maxDiscountCents?: number;

    @IsInt()
    @Min(0)
    minPurchaseCents: number;

    @IsString()
    currency: string;

    @IsBoolean()
    isUsed: boolean;

    @IsBoolean()
    isActive: boolean;

    @IsOptional()
    @IsDateString()
    expiresAt?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    vipDurationDays?: number;

    @IsOptional()
    @IsString()
    sourceType?: string;

    @IsDateString()
    createdAt: string;
}

export class VipStatusResponseDto {
    @IsBoolean()
    isVip: boolean;

    @IsOptional()
    @IsEnum(['percentage', 'fixed'])
    discountType?: 'percentage' | 'fixed';

    @IsOptional()
    @IsInt()
    @Min(0)
    discountValue?: number;

    @IsOptional()
    @IsDateString()
    activatedAt?: string;

    @IsOptional()
    @IsDateString()
    expiresAt?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    remainingDays?: number;
}

export class CouponValidationResultDto {
    @IsBoolean()
    isValid: boolean;

    @IsOptional()
    @IsString()
    errorMessage?: string;

    @IsOptional()
    @IsString()
    couponType?: string;

    @IsOptional()
    @IsEnum(['percentage', 'fixed'])
    discountType?: 'percentage' | 'fixed';

    @IsOptional()
    @IsInt()
    @Min(0)
    discountValue?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    discountAmountCents?: number;
}

class AppliedCouponItemDto {
    @IsString()
    code: string;

    @IsString()
    type: string;

    @IsInt()
    @Min(0)
    discountApplied: number;
}

export class AppliedDiscountsDto {
    @IsInt()
    @Min(0)
    userCouponsDiscount: number;

    @IsInt()
    @Min(0)
    referralCodeDiscount: number;

    @IsInt()
    @Min(0)
    vipDiscount: number;

    @IsInt()
    @Min(0)
    totalDiscount: number;

    @IsInt()
    @Min(0)
    finalTotal: number;

    @ValidateNested({ each: true })
    @Type(() => AppliedCouponItemDto)
    appliedCoupons: AppliedCouponItemDto[];

    // Display prices in user's preferred currency
    @IsOptional()
    @Type(() => Number)
    @Min(0)
    display_total_discount?: number;

    @IsOptional()
    @Type(() => Number)
    @Min(0)
    display_final_total?: number;

    @IsOptional()
    @IsString()
    display_currency?: string;
}
