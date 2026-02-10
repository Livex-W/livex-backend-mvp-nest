/**
 * Domain Policy: Refund
 * Encapsulates the business rules for payment refunds.
 */
export class RefundPolicy {
    private static readonly DEFAULT_REFUND_WINDOW_HOURS = 48;

    /**
     * Check if a refund can be requested based on payment time.
     * @param paidAt - When the payment was made
     * @param windowHours - Refund window in hours (default: 48)
     */
    static isWithinRefundWindow(
        paidAt: Date,
        windowHours: number = this.DEFAULT_REFUND_WINDOW_HOURS,
    ): boolean {
        const hoursSincePaid = this.getHoursSincePaid(paidAt);
        return hoursSincePaid <= windowHours;
    }

    /**
     * Get hours elapsed since payment.
     */
    static getHoursSincePaid(paidAt: Date): number {
        return (Date.now() - paidAt.getTime()) / (1000 * 60 * 60);
    }

    /**
     * Get remaining hours in refund window.
     */
    static getRemainingRefundHours(
        paidAt: Date,
        windowHours: number = this.DEFAULT_REFUND_WINDOW_HOURS,
    ): number {
        const remaining = windowHours - this.getHoursSincePaid(paidAt);
        return Math.max(0, remaining);
    }

    /**
     * Get the deadline for refund requests.
     */
    static getRefundDeadline(
        paidAt: Date,
        windowHours: number = this.DEFAULT_REFUND_WINDOW_HOURS,
    ): Date {
        const deadline = new Date(paidAt);
        deadline.setHours(deadline.getHours() + windowHours);
        return deadline;
    }

    /**
     * Validate refund amount against payment amount.
     */
    static isValidRefundAmount(
        refundAmountCents: number,
        paymentAmountCents: number,
        alreadyRefundedCents: number = 0,
    ): boolean {
        if (refundAmountCents <= 0) return false;
        return refundAmountCents <= (paymentAmountCents - alreadyRefundedCents);
    }

    /**
     * Check if payment status allows refund.
     */
    static canRefundStatus(paymentStatus: string): boolean {
        return paymentStatus === 'paid';
    }
}
