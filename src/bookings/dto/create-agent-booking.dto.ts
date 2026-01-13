import { Type } from 'class-transformer';
import {
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Min,
} from 'class-validator';

export enum AgentPaymentType {
    FULL_AT_RESORT = 'full_at_resort',
    DEPOSIT_TO_AGENT = 'deposit_to_agent',
    COMMISSION_TO_AGENT = 'commission_to_agent',
}

/**
 * DTO for creating a booking from Livex-BNG (agent panel).
 * No online payment - all payments are physical.
 */
export class CreateAgentBookingDto {
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

    // Agent commission per person (agent decides this)
    @Type(() => Number)
    @IsInt()
    @Min(0)
    agentCommissionPerAdultCents!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    agentCommissionPerChildCents: number = 0;

    // Payment type and distribution
    @IsEnum(AgentPaymentType)
    agentPaymentType!: AgentPaymentType;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    amountPaidToAgentCents: number = 0;

    // Client information (optional if client already exists)
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
