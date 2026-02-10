import { Inject, Injectable } from '@nestjs/common';
import { DatabaseClient } from '../../../../database/database.client';
import { DATABASE_CLIENT } from '../../../../database/database.module';
import { VipSubscription } from '../../domain/aggregates/vip-subscription.aggregate';
import { IVipSubscriptionRepository } from '../../domain/repositories/vip-subscription.repository.interface';
import { VipSubscriptionMapper } from './vip-subscription.mapper';

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

@Injectable()
export class VipSubscriptionRepository implements IVipSubscriptionRepository {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    ) { }

    async save(subscription: VipSubscription): Promise<void> {
        const data = VipSubscriptionMapper.toPersistence(subscription);

        await this.db.query(
            `INSERT INTO vip_subscriptions (
                id, user_id, discount_type, discount_value, activated_at, expires_at,
                source_type, coupon_id, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
                expires_at = EXCLUDED.expires_at,
                updated_at = EXCLUDED.updated_at`,
            [
                data.id, data.user_id, data.discount_type, data.discount_value,
                data.activated_at, data.expires_at, data.source_type, data.coupon_id,
                data.created_at, data.updated_at,
            ],
        );
    }

    async findById(id: string): Promise<VipSubscription | null> {
        const result = await this.db.query<VipSubscriptionRow>(
            'SELECT * FROM vip_subscriptions WHERE id = $1',
            [id],
        );
        if (result.rows.length === 0) return null;
        return VipSubscriptionMapper.toDomain(result.rows[0]);
    }

    async findActiveByUserId(userId: string): Promise<VipSubscription | null> {
        const result = await this.db.query<VipSubscriptionRow>(
            `SELECT * FROM vip_subscriptions 
            WHERE user_id = $1 
                AND activated_at <= NOW() 
                AND expires_at > NOW()
            ORDER BY expires_at DESC
            LIMIT 1`,
            [userId],
        );
        if (result.rows.length === 0) return null;
        return VipSubscriptionMapper.toDomain(result.rows[0]);
    }

    async findByUserId(userId: string): Promise<VipSubscription[]> {
        const result = await this.db.query<VipSubscriptionRow>(
            'SELECT * FROM vip_subscriptions WHERE user_id = $1 ORDER BY activated_at DESC',
            [userId],
        );
        return result.rows.map(row => VipSubscriptionMapper.toDomain(row));
    }

    async delete(id: string): Promise<void> {
        await this.db.query('DELETE FROM vip_subscriptions WHERE id = $1', [id]);
    }
}
