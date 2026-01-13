/**
 * Entity representing a booking record from the database.
 * This mirrors the bookings table structure.
 */
export interface Booking {
    id: string;
    user_id: string;
    experience_id: string;
    slot_id: string;

    // Source of booking
    booking_source: 'app' | 'bng';

    adults: number;
    children: number;
    subtotal_cents: number;
    tax_cents: number;

    // LIVEX commission (only for app)
    commission_cents: number;
    resort_net_cents: number;
    vip_discount_cents: number;

    // Agent commission (only for BNG)
    agent_commission_per_adult_cents: number;
    agent_commission_per_child_cents: number;
    agent_commission_cents: number;

    // BNG payment distribution
    agent_payment_type?: 'full_at_resort' | 'deposit_to_agent' | 'commission_to_agent';
    amount_paid_to_agent_cents: number;
    amount_paid_to_resort_cents: number;

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

    // Display prices in user's preferred currency
    display_subtotal?: number;
    display_tax?: number;
    display_total?: number;
    display_currency?: string;
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
