import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseClient } from '../../../../database/database.client';
import { DATABASE_CLIENT } from '../../../../database/database.module';
import { Coupon } from '../../domain/aggregates/coupon.aggregate';
import { ICouponRepository } from '../../domain/repositories/coupon.repository.interface';
import { CouponMapper } from './coupon.mapper';

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

@Injectable()
export class CouponRepository implements ICouponRepository {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async save(coupon: Coupon): Promise<void> {
        const data = CouponMapper.toPersistence(coupon);

        await this.db.query(
            `INSERT INTO user_coupons (
                id, code, coupon_type, description, discount_type, discount_value,
                max_discount_cents, min_purchase_cents, currency, is_used, is_active,
                expires_at, vip_duration_days, experience_id, category_slug, resort_id,
                user_id, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            ON CONFLICT (id) DO UPDATE SET
                is_used = EXCLUDED.is_used,
                is_active = EXCLUDED.is_active,
                updated_at = EXCLUDED.updated_at`,
            [
                data.id, data.code, data.coupon_type, data.description, data.discount_type,
                data.discount_value, data.max_discount_cents, data.min_purchase_cents, data.currency,
                data.is_used, data.is_active, data.expires_at, data.vip_duration_days,
                data.experience_id, data.category_slug, data.resort_id, data.user_id,
                data.created_at, data.updated_at,
            ],
        );

        // Publish domain events
        for (const event of coupon.domainEvents) {
            this.eventEmitter.emit(event.eventName, event.toPayload());
        }
        coupon.clearDomainEvents();
    }

    async findById(id: string): Promise<Coupon | null> {
        const result = await this.db.query<UserCouponRow>(
            'SELECT * FROM user_coupons WHERE id = $1',
            [id],
        );
        if (result.rows.length === 0) return null;
        return CouponMapper.toDomain(result.rows[0]);
    }

    async findByCode(code: string): Promise<Coupon | null> {
        const result = await this.db.query<UserCouponRow>(
            'SELECT * FROM user_coupons WHERE UPPER(code) = UPPER($1)',
            [code],
        );
        if (result.rows.length === 0) return null;
        return CouponMapper.toDomain(result.rows[0]);
    }

    async findByUserId(userId: string): Promise<Coupon[]> {
        const result = await this.db.query<UserCouponRow>(
            'SELECT * FROM user_coupons WHERE user_id = $1 ORDER BY created_at DESC',
            [userId],
        );
        return result.rows.map(row => CouponMapper.toDomain(row));
    }

    async findAvailableByUserId(userId: string): Promise<Coupon[]> {
        const result = await this.db.query<UserCouponRow>(
            `SELECT * FROM user_coupons 
            WHERE user_id = $1 
                AND is_used = false 
                AND is_active = true 
                AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC`,
            [userId],
        );
        return result.rows.map(row => CouponMapper.toDomain(row));
    }

    async findByExperienceId(experienceId: string): Promise<Coupon[]> {
        const result = await this.db.query<UserCouponRow>(
            'SELECT * FROM user_coupons WHERE experience_id = $1',
            [experienceId],
        );
        return result.rows.map(row => CouponMapper.toDomain(row));
    }

    async delete(id: string): Promise<void> {
        await this.db.query('DELETE FROM user_coupons WHERE id = $1', [id]);
    }

    async exists(id: string): Promise<boolean> {
        const result = await this.db.query<{ exists: boolean }>(
            'SELECT EXISTS(SELECT 1 FROM user_coupons WHERE id = $1) as exists',
            [id],
        );
        return result.rows[0]?.exists ?? false;
    }
}
