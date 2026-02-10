import { Coupon, CouponCode, CouponType, Discount } from '../../domain/index';

interface UserCouponRow {
    id: string;
    code: string;
    coupon_type: string;
    description: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    max_discount_cents?: number;
    min_purchase_cents: number;
    currency: string;
    is_used: boolean;
    is_active: boolean;
    expires_at?: Date;
    vip_duration_days?: number;
    experience_id?: string;
    category_slug?: string;
    resort_id?: string;
    user_id?: string;
    created_at: Date;
    updated_at: Date;
}

export class CouponMapper {
    static toDomain(row: UserCouponRow): Coupon {
        const discount = row.discount_type === 'percentage'
            ? Discount.percentage(row.discount_value, row.max_discount_cents)
            : Discount.fixed(row.discount_value, row.currency);

        return Coupon.reconstitute(row.id, {
            code: CouponCode.create(row.code),
            couponType: CouponType.fromString(row.coupon_type),
            description: row.description,
            discount,
            minPurchaseCents: row.min_purchase_cents,
            currency: row.currency,
            isUsed: row.is_used,
            isActive: row.is_active,
            expiresAt: row.expires_at,
            vipDurationDays: row.vip_duration_days,
            experienceId: row.experience_id,
            categorySlug: row.category_slug,
            resortId: row.resort_id,
            userId: row.user_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }

    static toPersistence(coupon: Coupon): Record<string, unknown> {
        return {
            id: coupon.id,
            code: coupon.code.value,
            coupon_type: coupon.couponType.value,
            description: coupon.description,
            discount_type: coupon.discount.type,
            discount_value: coupon.discount.value,
            max_discount_cents: coupon.discount.maxDiscountCents,
            min_purchase_cents: coupon.minPurchaseCents,
            currency: coupon.currency,
            is_used: coupon.isUsed,
            is_active: coupon.isActive,
            expires_at: coupon.expiresAt,
            vip_duration_days: coupon.vipDurationDays,
            experience_id: coupon.experienceId,
            category_slug: coupon.categorySlug,
            resort_id: coupon.resortId,
            user_id: coupon.userId,
            created_at: coupon.createdAt,
            updated_at: coupon.updatedAt,
        };
    }
}
