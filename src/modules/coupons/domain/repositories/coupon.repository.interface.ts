import { Coupon } from '../aggregates/coupon.aggregate';

export const COUPON_REPOSITORY = Symbol('COUPON_REPOSITORY');

export interface ICouponRepository {
    save(coupon: Coupon): Promise<void>;
    findById(id: string): Promise<Coupon | null>;
    findByCode(code: string): Promise<Coupon | null>;
    findByUserId(userId: string): Promise<Coupon[]>;
    findAvailableByUserId(userId: string): Promise<Coupon[]>;
    findByExperienceId(experienceId: string): Promise<Coupon[]>;
    delete(id: string): Promise<void>;
    exists(id: string): Promise<boolean>;
}
