import { Type } from 'class-transformer';
import {
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

/**
 * DTO representing experience details within a booking.
 */
export class BookingExperienceDto {
    @IsUUID()
    id!: string;

    @IsString()
    title!: string;

    @IsString()
    slug!: string;

    @IsString()
    main_image_url!: string;

    @IsString()
    category!: string;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    price_cents!: number;

    @IsString()
    currency!: string;
}

/**
 * DTO representing slot details within a booking.
 */
export class BookingSlotDto {
    @IsUUID()
    id!: string;

    @IsUUID()
    experience_id!: string;

    @IsString()
    start_time!: string;

    @IsString()
    end_time!: string;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    capacity!: number;
}

/**
 * DTO representing a booking with its related experience and slot details.
 * Used as the response type for user bookings listing.
 */
export class BookingWithDetailsDto {
    @IsUUID()
    id!: string;

    @IsUUID()
    user_id!: string;

    @IsUUID()
    experience_id!: string;

    @IsUUID()
    slot_id!: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    adults!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    children!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    subtotal_cents!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    tax_cents!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    total_cents!: number;

    @IsString()
    currency!: string;

    @IsString()
    status!: string;

    @IsOptional()
    @IsString()
    cancel_reason!: string | null;

    @IsOptional()
    @IsString()
    expires_at!: string | null;

    @IsString()
    created_at!: string;

    @IsString()
    updated_at!: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => BookingExperienceDto)
    experience!: BookingExperienceDto | null;

    @IsOptional()
    @ValidateNested()
    @Type(() => BookingSlotDto)
    slot!: BookingSlotDto | null;
}
