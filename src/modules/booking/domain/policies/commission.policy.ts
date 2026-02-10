/**
 * Domain Policy: Commission Calculation
 * Encapsulates the business rules for calculating platform and agent commissions.
 */
export class CommissionPolicy {
    /**
     * Calculate platform commission from experience pricing.
     */
    static calculatePlatformCommission(params: {
        commissionPerAdultCents: number;
        commissionPerChildCents: number;
        adults: number;
        children: number;
    }): number {
        return (params.commissionPerAdultCents * params.adults) +
            (params.commissionPerChildCents * params.children);
    }

    /**
     * Calculate agent commission from agent agreement.
     */
    static calculateAgentCommission(params: {
        agentCommissionPerAdultCents: number;
        agentCommissionPerChildCents: number;
        adults: number;
        children: number;
    }): number {
        return (params.agentCommissionPerAdultCents * params.adults) +
            (params.agentCommissionPerChildCents * params.children);
    }

    /**
     * Calculate resort net amount after commissions.
     */
    static calculateResortNet(params: {
        subtotalCents: number;
        platformCommissionCents: number;
        agentCommissionCents: number;
    }): number {
        return params.subtotalCents - params.platformCommissionCents - params.agentCommissionCents;
    }

    /**
     * Calculate total with tax applied.
     */
    static calculateTotalWithTax(subtotalCents: number, taxRate: number): number {
        const taxCents = Math.round(subtotalCents * taxRate);
        return subtotalCents + taxCents;
    }

    /**
     * Apply VIP discount percentage.
     */
    static applyVipDiscount(subtotalCents: number, discountPercent: number): {
        discountCents: number;
        finalAmount: number;
    } {
        const discountCents = Math.round(subtotalCents * discountPercent / 100);
        return {
            discountCents,
            finalAmount: subtotalCents - discountCents,
        };
    }
}
