/**
 * Domain Policy: Slot Validation
 * Encapsulates the business rules for availability slot validation.
 */
export class SlotValidationPolicy {
    /**
     * Validate date range is valid.
     */
    static validateDateRange(fromDate: string, toDate: string): { valid: boolean; error?: string } {
        const from = new Date(fromDate);
        const to = new Date(toDate);

        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            return { valid: false, error: 'Invalid date format' };
        }

        if (from > to) {
            return { valid: false, error: 'Start date must be before or equal to end date' };
        }

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (from < now) {
            return { valid: false, error: 'Start date cannot be in the past' };
        }

        // Max range check (e.g., 1 year ahead)
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + 1);
        if (to > maxDate) {
            return { valid: false, error: 'End date cannot be more than 1 year ahead' };
        }

        return { valid: true };
    }

    /**
     * Validate time range is valid.
     */
    static validateTimeRange(startTime: string, endTime: string): { valid: boolean; error?: string } {
        const timePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/;

        if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
            return { valid: false, error: 'Invalid time format. Expected ISO format' };
        }

        const start = new Date(startTime);
        const end = new Date(endTime);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return { valid: false, error: 'Invalid datetime value' };
        }

        if (start >= end) {
            return { valid: false, error: 'Start time must be before end time' };
        }

        // Duration check (min 15 minutes, max 24 hours)
        const durationMs = end.getTime() - start.getTime();
        const minDurationMs = 15 * 60 * 1000; // 15 minutes
        const maxDurationMs = 24 * 60 * 60 * 1000; // 24 hours

        if (durationMs < minDurationMs) {
            return { valid: false, error: 'Slot duration must be at least 15 minutes' };
        }
        if (durationMs > maxDurationMs) {
            return { valid: false, error: 'Slot duration cannot exceed 24 hours' };
        }

        return { valid: true };
    }

    /**
     * Check if two time ranges overlap.
     */
    static doTimesOverlap(
        start1: Date, end1: Date,
        start2: Date, end2: Date,
    ): boolean {
        return start1 < end2 && start2 < end1;
    }

    /**
     * Validate capacity is reasonable.
     */
    static validateCapacity(capacity: number): { valid: boolean; error?: string } {
        if (!Number.isInteger(capacity)) {
            return { valid: false, error: 'Capacity must be an integer' };
        }
        if (capacity < 1) {
            return { valid: false, error: 'Capacity must be at least 1' };
        }
        if (capacity > 1000) {
            return { valid: false, error: 'Capacity cannot exceed 1000' };
        }
        return { valid: true };
    }

    /**
     * Validate price in cents.
     */
    static validatePrice(priceCents: number): { valid: boolean; error?: string } {
        if (!Number.isInteger(priceCents)) {
            return { valid: false, error: 'Price must be an integer (cents)' };
        }
        if (priceCents < 0) {
            return { valid: false, error: 'Price cannot be negative' };
        }
        if (priceCents > 100000000) { // Max 1 million in currency units
            return { valid: false, error: 'Price exceeds maximum allowed' };
        }
        return { valid: true };
    }
}
