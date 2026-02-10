/**
 * Domain Policy: VIP Activation
 * Encapsulates the business rules for VIP subscription activation.
 */
export class VipActivationPolicy {
    /**
     * Check if user is eligible for VIP activation.
     */
    static canActivateVip(params: {
        hasActiveVip: boolean;
        currentVipExpiresAt?: Date;
    }): { canActivate: boolean; reason?: string } {
        if (params.hasActiveVip && params.currentVipExpiresAt) {
            const now = new Date();
            if (params.currentVipExpiresAt > now) {
                return {
                    canActivate: false,
                    reason: 'User already has an active VIP subscription',
                };
            }
        }
        return { canActivate: true };
    }

    /**
     * Calculate VIP subscription expiration date.
     */
    static calculateExpiresAt(durationDays: number, startFrom?: Date): Date {
        const start = startFrom || new Date();
        const expires = new Date(start);
        expires.setDate(expires.getDate() + durationDays);
        return expires;
    }

    /**
     * Check if VIP subscription is currently active.
     */
    static isVipActive(expiresAt: Date | undefined): boolean {
        if (!expiresAt) return false;
        return new Date() < expiresAt;
    }

    /**
     * Get remaining VIP days.
     */
    static getRemainingDays(expiresAt: Date): number {
        const remaining = expiresAt.getTime() - Date.now();
        return Math.max(0, Math.ceil(remaining / (1000 * 60 * 60 * 24)));
    }

    /**
     * Check if VIP is about to expire (within N days).
     */
    static isNearExpiry(expiresAt: Date, thresholdDays: number = 7): boolean {
        return this.getRemainingDays(expiresAt) <= thresholdDays;
    }

    /**
     * Validate VIP coupon can be used for activation.
     */
    static isVipCouponValid(params: {
        couponType: string;
        isUsed: boolean;
        isActive: boolean;
        expiresAt?: Date;
    }): { valid: boolean; reason?: string } {
        if (params.couponType !== 'vip_subscription') {
            return { valid: false, reason: 'Coupon is not a VIP subscription coupon' };
        }

        if (params.isUsed) {
            return { valid: false, reason: 'Coupon has already been used' };
        }

        if (!params.isActive) {
            return { valid: false, reason: 'Coupon is not active' };
        }

        if (params.expiresAt && new Date() > params.expiresAt) {
            return { valid: false, reason: 'Coupon has expired' };
        }

        return { valid: true };
    }
}
