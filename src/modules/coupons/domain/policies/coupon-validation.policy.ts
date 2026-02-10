/**
 * Domain Policy: Coupon Validation
 * Encapsulates the business rules for coupon validity and application.
 */
export class CouponValidationPolicy {
    /**
     * Check if coupon is within valid date range.
     */
    static isWithinValidDates(validFrom: Date, validUntil: Date): boolean {
        const now = new Date();
        return now >= validFrom && now <= validUntil;
    }

    /**
     * Check if coupon has remaining uses.
     */
    static hasRemainingUses(usageCount: number, maxUses: number | undefined): boolean {
        if (maxUses === undefined || maxUses === null) return true; // Unlimited
        return usageCount < maxUses;
    }

    /**
     * Check if minimum purchase requirement is met.
     */
    static meetsMinimumPurchase(
        cartTotalCents: number,
        minPurchaseCents: number | undefined,
    ): boolean {
        if (!minPurchaseCents) return true;
        return cartTotalCents >= minPurchaseCents;
    }

    /**
     * Calculate discount amount based on coupon type.
     */
    static calculateDiscount(params: {
        type: 'percentage' | 'fixed';
        value: number;
        cartTotalCents: number;
        maxDiscountCents?: number;
    }): number {
        let discount: number;

        if (params.type === 'percentage') {
            discount = Math.round(params.cartTotalCents * params.value / 100);
        } else {
            discount = params.value; // Fixed amount in cents
        }

        // Apply max cap if set
        if (params.maxDiscountCents && discount > params.maxDiscountCents) {
            discount = params.maxDiscountCents;
        }

        // Ensure discount doesn't exceed cart total
        return Math.min(discount, params.cartTotalCents);
    }

    /**
     * Validate coupon is applicable for experience.
     */
    static isApplicableToExperience(
        couponExperienceIds: string[],
        targetExperienceId: string,
    ): boolean {
        if (couponExperienceIds.length === 0) return true; // No restrictions
        return couponExperienceIds.includes(targetExperienceId);
    }

    /**
     * Validate coupon is applicable for category.
     */
    static isApplicableToCategory(
        couponCategorySlugs: string[],
        targetCategorySlug: string,
    ): boolean {
        if (couponCategorySlugs.length === 0) return true; // No restrictions
        return couponCategorySlugs.includes(targetCategorySlug);
    }
}
