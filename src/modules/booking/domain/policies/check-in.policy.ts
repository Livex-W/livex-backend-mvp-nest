/**
 * Domain Policy: Check-In
 * Encapsulates the business rules for booking check-in.
 */
export class CheckInPolicy {
    private static readonly DEFAULT_HOURS_BEFORE_ALLOWED = 2;

    /**
     * Check if booking can be checked in based on slot time.
     */
    static canCheckIn(params: {
        slotStartTime: Date;
        bookingStatus: string;
        hoursBeforeAllowed?: number;
    }): { allowed: boolean; reason?: string } {
        const { slotStartTime, bookingStatus, hoursBeforeAllowed } = params;
        const threshold = hoursBeforeAllowed ?? this.DEFAULT_HOURS_BEFORE_ALLOWED;

        // Must be confirmed status
        if (bookingStatus !== 'confirmed') {
            return {
                allowed: false,
                reason: `Cannot check in booking with status: ${bookingStatus}`,
            };
        }

        const now = new Date();
        const checkInWindowStart = new Date(slotStartTime);
        checkInWindowStart.setHours(checkInWindowStart.getHours() - threshold);

        // Can't check in before window opens
        if (now < checkInWindowStart) {
            const hoursUntil = Math.ceil((checkInWindowStart.getTime() - now.getTime()) / (1000 * 60 * 60));
            return {
                allowed: false,
                reason: `Check-in opens ${threshold} hours before the experience. Available in ${hoursUntil} hours.`,
            };
        }

        // Get end of check-in window (slot end time)
        const endOfDay = new Date(slotStartTime);
        endOfDay.setHours(23, 59, 59, 999);

        // Can't check in after the day ends
        if (now > endOfDay) {
            return {
                allowed: false,
                reason: 'Check-in window has passed',
            };
        }

        return { allowed: true };
    }

    /**
     * Check if booking is already checked in.
     */
    static isAlreadyCheckedIn(checkedInAt?: Date): boolean {
        return !!checkedInAt;
    }

    /**
     * Get time remaining until check-in window opens.
     */
    static getTimeUntilCheckInWindow(
        slotStartTime: Date,
        hoursBeforeAllowed: number = this.DEFAULT_HOURS_BEFORE_ALLOWED,
    ): number {
        const checkInWindowStart = new Date(slotStartTime);
        checkInWindowStart.setHours(checkInWindowStart.getHours() - hoursBeforeAllowed);

        const remaining = checkInWindowStart.getTime() - Date.now();
        return Math.max(0, remaining);
    }

    /**
     * Validate check-in is being done by authorized user (resort owner).
     */
    static canUserCheckIn(params: {
        resortOwnerId: string;
        requesterId: string;
        requesterRole: string;
    }): boolean {
        // Admin can always check in
        if (params.requesterRole === 'admin') return true;

        // Resort owner can check in their bookings
        if (params.requesterRole === 'resort_owner' &&
            params.resortOwnerId === params.requesterId) {
            return true;
        }

        return false;
    }
}
