/**
 * Domain Policy: Discount Stacking
 * Encapsulates the business rules for combining multiple discounts.
 */
export class DiscountStackingPolicy {
    /**
     * Determine if discounts can be stacked together.
     * @param allowStackingFlags - Array of stacking permission flags for each discount
     */
    static canStackDiscounts(allowStackingFlags: boolean[]): boolean {
        // All discounts must allow stacking for combination
        return allowStackingFlags.every(flag => flag === true);
    }

    /**
     * Calculate total discount with stacking rules.
     * - User coupons and VIP discounts are always applied
     * - Referral codes only stack if allowStacking is true
     * - Discounts are applied sequentially (multiplicative, not additive)
     */
    static calculateStackedDiscount(params: {
        subtotalCents: number;
        userCouponDiscountCents: number;
        vipDiscountCents: number;
        referralDiscountCents: number;
        referralAllowsStacking: boolean;
    }): {
        totalDiscountCents: number;
        appliedDiscounts: { type: string; amountCents: number }[];
    } {
        const appliedDiscounts: { type: string; amountCents: number }[] = [];
        let runningTotal = params.subtotalCents;

        // Apply user coupon first
        if (params.userCouponDiscountCents > 0) {
            const couponDiscount = Math.min(params.userCouponDiscountCents, runningTotal);
            appliedDiscounts.push({ type: 'user_coupon', amountCents: couponDiscount });
            runningTotal -= couponDiscount;
        }

        // Apply VIP discount
        if (params.vipDiscountCents > 0) {
            const vipDiscount = Math.min(params.vipDiscountCents, runningTotal);
            appliedDiscounts.push({ type: 'vip', amountCents: vipDiscount });
            runningTotal -= vipDiscount;
        }

        // Apply referral discount (only if stacking allowed or no other discounts)
        if (params.referralDiscountCents > 0) {
            const otherDiscountsApplied = appliedDiscounts.length > 0;

            if (!otherDiscountsApplied || params.referralAllowsStacking) {
                const referralDiscount = Math.min(params.referralDiscountCents, runningTotal);
                appliedDiscounts.push({ type: 'referral', amountCents: referralDiscount });
                runningTotal -= referralDiscount;
            }
        }

        const totalDiscountCents = params.subtotalCents - runningTotal;
        return { totalDiscountCents, appliedDiscounts };
    }

    /**
     * Calculate discount per guest for per-person pricing.
     */
    static calculatePerGuestDiscount(
        totalDiscountCents: number,
        guestCount: number,
    ): number {
        if (guestCount <= 0) return 0;
        return Math.round(totalDiscountCents / guestCount);
    }

    /**
     * Ensure total discount doesn't exceed subtotal.
     */
    static capDiscountToSubtotal(
        discountCents: number,
        subtotalCents: number,
    ): number {
        return Math.min(discountCents, subtotalCents);
    }
}
