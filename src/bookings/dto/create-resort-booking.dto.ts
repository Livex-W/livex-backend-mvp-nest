import { Type } from 'class-transformer';
import {
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Min,
} from 'class-validator';

/**
 * DTO for creating a booking from resort panel.
 * Simplified version - no agent commission fields.
 * Payment is always full_at_resort.
 */
export class CreateResortBookingDto {
    @IsUUID()
    slotId!: string;

    @IsUUID()
    experienceId!: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    adults!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    children: number = 0;

    // Client information
    @IsOptional()
    @IsUUID()
    clientUserId?: string;

    @IsOptional()
    @IsString()
    clientName?: string;

    @IsOptional()
    @IsString()
    clientPhone?: string;

    @IsOptional()
    @IsString()
    clientEmail?: string;
}
