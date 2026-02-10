/**
 * Domain Policy: Slot Capacity
 * Encapsulates the business rules for slot capacity calculation.
 */
export class SlotCapacityPolicy {
    /**
     * Calculate remaining capacity after bookings and locks.
     */
    static calculateRemaining(params: {
        maxCapacity: number;
        bookedCount: number;
        lockedCount: number;
    }): number {
        const remaining = params.maxCapacity - params.bookedCount - params.lockedCount;
        return Math.max(0, remaining);
    }

    /**
     * Check if slot has enough capacity for a booking.
     */
    static hasCapacity(params: {
        maxCapacity: number;
        bookedCount: number;
        lockedCount: number;
        requestedCount: number;
    }): { available: boolean; remaining: number } {
        const remaining = this.calculateRemaining({
            maxCapacity: params.maxCapacity,
            bookedCount: params.bookedCount,
            lockedCount: params.lockedCount,
        });

        return {
            available: remaining >= params.requestedCount,
            remaining,
        };
    }

    /**
     * Check if slot is fully booked.
     */
    static isFullyBooked(params: {
        maxCapacity: number;
        bookedCount: number;
    }): boolean {
        return params.bookedCount >= params.maxCapacity;
    }

    /**
     * Check if slot has low availability (below threshold percentage).
     */
    static isLowAvailability(params: {
        maxCapacity: number;
        bookedCount: number;
        lockedCount: number;
        thresholdPercent?: number;
    }): boolean {
        const threshold = params.thresholdPercent ?? 20;
        const remaining = this.calculateRemaining({
            maxCapacity: params.maxCapacity,
            bookedCount: params.bookedCount,
            lockedCount: params.lockedCount,
        });
        const remainingPercent = (remaining / params.maxCapacity) * 100;
        return remainingPercent <= threshold;
    }

    /**
     * Get availability percentage.
     */
    static getAvailabilityPercent(params: {
        maxCapacity: number;
        bookedCount: number;
        lockedCount: number;
    }): number {
        const remaining = this.calculateRemaining(params);
        return Math.round((remaining / params.maxCapacity) * 100);
    }

    /**
     * Validate booking quantity doesn't exceed limits.
     */
    static validateBookingQuantity(params: {
        adults: number;
        children: number;
        maxPerBooking?: number;
    }): { valid: boolean; error?: string } {
        const total = params.adults + (params.children || 0);
        const maxPerBooking = params.maxPerBooking ?? 20;

        if (params.adults < 1) {
            return { valid: false, error: 'At least 1 adult is required' };
        }
        if (params.children < 0) {
            return { valid: false, error: 'Children count cannot be negative' };
        }
        if (total > maxPerBooking) {
            return { valid: false, error: `Maximum ${maxPerBooking} guests per booking` };
        }

        return { valid: true };
    }
}
