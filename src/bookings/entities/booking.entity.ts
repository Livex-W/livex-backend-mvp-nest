/**
 * Entity representing a booking record from the database.
 * This mirrors the bookings table structure.
 */
export interface Booking {
    id: string;
    user_id: string;
    experience_id: string;
    slot_id: string;
    adults: number;
    children: number;
    subtotal_cents: number;
    tax_cents: number;
    commission_cents: number;
    resort_net_cents: number;
    total_cents: number;
    currency: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded' | 'expired';
    expires_at?: Date;
    cancel_reason?: string;
    idempotency_key?: string;
    agent_id?: string;
    referral_code_id?: string;
    created_at: Date;
    updated_at: Date;
}

/**
 * Options for confirming a pending booking.
 */
export interface ConfirmBookingOptions {
    bookingId: string;
    confirmedAt?: Date;
}

/**
 * Options for cancelling a booking.
 */
export interface CancelBookingOptions {
    bookingId: string;
    reason?: string;
    cancelledAt?: Date;
}

/**
 * Result of the expire stale bookings operation.
 */
export interface ExpireBookingsResult {
    expired: number;
}
