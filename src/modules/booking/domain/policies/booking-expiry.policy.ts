/**
 * Domain Policy: Booking Expiry
 * Encapsulates the business rules for pending booking expiration.
 */
export class BookingExpiryPolicy {
    private static readonly DEFAULT_TTL_MINUTES = 15;

    /**
     * Calculate expiration date for a pending booking.
     * @param ttlMinutes - Time to live in minutes (default: 15)
     */
    static calculateExpiresAt(ttlMinutes: number = this.DEFAULT_TTL_MINUTES): Date {
        const expires = new Date();
        expires.setMinutes(expires.getMinutes() + ttlMinutes);
        return expires;
    }

    /**
     * Check if a booking has expired based on its expiration date.
     */
    static isExpired(expiresAt: Date | undefined): boolean {
        if (!expiresAt) return false;
        return new Date() > expiresAt;
    }

    /**
     * Get remaining time in minutes before expiration.
     */
    static getRemainingMinutes(expiresAt: Date): number {
        const remaining = expiresAt.getTime() - Date.now();
        return Math.max(0, Math.ceil(remaining / (1000 * 60)));
    }

    /**
     * Check if booking is close to expiring (within grace period).
     * @param expiresAt - Expiration date
     * @param graceMinutes - Grace period in minutes (default: 2)
     */
    static isNearExpiry(expiresAt: Date, graceMinutes: number = 2): boolean {
        return this.getRemainingMinutes(expiresAt) <= graceMinutes;
    }

    /**
     * Extend expiration by additional minutes.
     */
    static extendExpiry(currentExpiresAt: Date, additionalMinutes: number): Date {
        const extended = new Date(currentExpiresAt);
        extended.setMinutes(extended.getMinutes() + additionalMinutes);
        return extended;
    }
}
