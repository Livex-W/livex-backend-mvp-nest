import { VipSubscription, Discount } from '../../domain/index';

interface VipSubscriptionRow {
    id: string;
    user_id: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    activated_at: Date;
    expires_at: Date;
    source_type?: string;
    coupon_id?: string;
    created_at: Date;
    updated_at: Date;
}

export class VipSubscriptionMapper {
    static toDomain(row: VipSubscriptionRow): VipSubscription {
        const discount = row.discount_type === 'percentage'
            ? Discount.percentage(row.discount_value)
            : Discount.fixed(row.discount_value, 'COP');

        return VipSubscription.reconstitute(row.id, {
            userId: row.user_id,
            discount,
            activatedAt: row.activated_at,
            expiresAt: row.expires_at,
            sourceType: row.source_type,
            couponId: row.coupon_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }

    static toPersistence(subscription: VipSubscription): Record<string, unknown> {
        return {
            id: subscription.id,
            user_id: subscription.userId,
            discount_type: subscription.discount.type,
            discount_value: subscription.discount.value,
            activated_at: subscription.activatedAt,
            expires_at: subscription.expiresAt,
            source_type: subscription.sourceType,
            coupon_id: subscription.couponId,
            created_at: subscription.createdAt,
            updated_at: subscription.updatedAt,
        };
    }
}
