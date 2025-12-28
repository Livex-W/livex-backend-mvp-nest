export class UserCouponResponseDto {
    id: string;
    code: string;
    couponType: 'user_earned' | 'vip_subscription' | 'promotional';
    description: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    maxDiscountCents?: number;
    minPurchaseCents: number;
    currency: string;
    isUsed: boolean;
    isActive: boolean;
    expiresAt?: string;
    vipDurationDays?: number;
    sourceType?: string;
    createdAt: string;
}

export class VipStatusResponseDto {
    isVip: boolean;
    discountType?: 'percentage' | 'fixed';
    discountValue?: number;
    activatedAt?: string;
    expiresAt?: string;
    remainingDays?: number;
}

export class CouponValidationResultDto {
    isValid: boolean;
    errorMessage?: string;
    couponType?: string;
    discountType?: 'percentage' | 'fixed';
    discountValue?: number;
    discountAmountCents?: number;
}

export class AppliedDiscountsDto {
    userCouponsDiscount: number;
    referralCodeDiscount: number;
    vipDiscount: number;
    totalDiscount: number;
    finalTotal: number;
    appliedCoupons: {
        code: string;
        type: string;
        discountApplied: number;
    }[];
}
