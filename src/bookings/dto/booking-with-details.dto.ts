/**
 * DTO representing a booking with its related experience and slot details.
 * Used as the response type for user bookings listing.
 */
export interface BookingWithDetailsDto {
    id: string;
    user_id: string;
    experience_id: string;
    slot_id: string;
    adults: number;
    children: number;
    subtotal_cents: number;
    tax_cents: number;
    total_cents: number;
    currency: string;
    status: string;
    cancel_reason: string | null;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
    experience: BookingExperienceDto | null;
    slot: BookingSlotDto | null;
}

export interface BookingExperienceDto {
    id: string;
    title: string;
    slug: string;
    main_image_url: string;
    category: string;
    price_cents: number;
    currency: string;
}

export interface BookingSlotDto {
    id: string;
    experience_id: string;
    start_time: string;
    end_time: string;
    capacity: number;
}
