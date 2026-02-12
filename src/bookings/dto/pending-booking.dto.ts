import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Min, IsDateString } from 'class-validator';

/**
 * Internal DTO for creating a pending booking.
 * Used by the service layer.
 */
export class CreatePendingBookingInputDto {
    @IsUUID()
    experienceId!: string;

    @IsUUID()
    slotId!: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    adults!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    children: number = 0;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    subtotalCents!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    taxCents!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    commissionCents!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    resortNetCents!: number;

    @IsString()
    currency: string = 'USD';

    @IsOptional()
    @IsUUID()
    agentId?: string;

    @IsOptional()
    @IsString()
    referralCode?: string;

    @IsOptional()
    @IsString()
    idempotencyKey?: string;
}

/**
 * Result DTO returned when a pending booking is created.
 */
export class PendingBookingResultDto {
    @IsUUID()
    bookingId!: string;

    @IsUUID()
    lockId!: string;

    @IsString()
    status!: 'pending';

    @IsDateString()
    expiresAt!: string;

    @IsUUID()
    slotId!: string;

    @IsUUID()
    experienceId!: string;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    totalCents!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    subtotalCents!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    taxCents!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    commissionCents!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    resortNetCents!: number;

    @IsString()
    currency!: string;

    @IsOptional()
    @IsString()
    bookingCode?: string;
}
