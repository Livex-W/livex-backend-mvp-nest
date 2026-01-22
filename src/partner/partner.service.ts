/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { CustomLoggerService } from '../common/services/logger.service';
import { PaginatedResult, PaginationMeta } from '../common/interfaces/pagination.interface';
import { PaginationDto } from '../common/dto/pagination.dto';

export interface PartnerDashboard {
    totalRevenue: number;
    totalCommissions: number;
    totalUses: number;
    activeCodesCount: number;
    confirmedBookingsCount: number;
    pendingBookingsCount: number;
}

export interface ReferralCode {
    id: string;
    code: string;
    codeType: string;
    referralType: string;
    agentCommissionType: string;
    agentCommissionCents: number;
    discountType: string | null;
    discountValue: number;
    isActive: boolean;
    usageCount: number;
    usageLimit: number | null;
    expiresAt: string | null;
    description: string | null;
    createdAt: string;
}

export interface ReferralCodeStats {
    code: ReferralCode;
    totalBookings: number;
    confirmedBookings: number;
    pendingBookings: number;
    cancelledBookings: number;
    totalRevenue: number;
    totalCommissions: number;
    conversionRate: number;
    firstUse: string | null;
    lastUse: string | null;
}

export interface PartnerBooking {
    id: string;
    status: string;
    adults: number;
    children: number;
    totalCents: number;
    currency: string;
    createdAt: string;
    experienceTitle: string;
    experienceId: string;
    resortName: string;
    referralCode: string;
    referralCodeId: string;
    userFullName: string;
}

export interface BookingFilters {
    status?: string;
    codeId?: string;
    startDate?: string;
    endDate?: string;
}

@Injectable()
export class PartnerService {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
        private readonly logger: CustomLoggerService,
    ) { }

    /**
     * Get partner dashboard statistics
     */
    async getPartnerDashboard(userId: string): Promise<PartnerDashboard> {
        // Get all referral codes owned by this partner
        const codesResult = await this.db.query(
            `SELECT id, agent_commission_type, agent_commission_cents 
       FROM referral_codes 
       WHERE owner_user_id = $1`,
            [userId],
        );

        const codeIds = codesResult.rows.map((r) => r.id);

        if (codeIds.length === 0) {
            return {
                totalRevenue: 0,
                totalCommissions: 0,
                totalUses: 0,
                activeCodesCount: 0,
                confirmedBookingsCount: 0,
                pendingBookingsCount: 0,
            };
        }

        // Get booking statistics using booking_referral_codes junction table
        const bookingsResult = await this.db.query(
            `SELECT 
         COUNT(*) FILTER (WHERE b.status = 'confirmed') as confirmed_count,
         COUNT(*) FILTER (WHERE b.status = 'pending') as pending_count,
         COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN b.total_cents ELSE 0 END), 0) as total_revenue
       FROM booking_referral_codes brc
       JOIN bookings b ON b.id = brc.booking_id
       WHERE brc.referral_code_id = ANY($1::uuid[])`,
            [codeIds],
        );

        // Calculate commissions based on commission type
        let totalCommissions = 0;
        for (const code of codesResult.rows) {
            const codeBookings = await this.db.query(
                `SELECT b.total_cents FROM booking_referral_codes brc
         JOIN bookings b ON b.id = brc.booking_id
         WHERE brc.referral_code_id = $1 AND b.status = 'confirmed'`,
                [code.id],
            );

            for (const booking of codeBookings.rows) {
                if (code.agent_commission_type === 'percentage') {
                    // Basis points: 500 = 5% = 0.05
                    totalCommissions += Math.floor(
                        (booking.total_cents * code.agent_commission_cents) / 10000,
                    );
                } else {
                    // Fixed amount per booking
                    totalCommissions += code.agent_commission_cents;
                }
            }
        }

        // Get active codes count
        const activeCodesResult = await this.db.query(
            `SELECT COUNT(*) as count FROM referral_codes 
       WHERE owner_user_id = $1 AND is_active = true`,
            [userId],
        );

        // Get total usage count
        const usageResult = await this.db.query(
            `SELECT COALESCE(SUM(usage_count), 0) as total_uses 
       FROM referral_codes 
       WHERE owner_user_id = $1`,
            [userId],
        );

        const bookingStats = bookingsResult.rows[0];

        return {
            totalRevenue: parseInt(bookingStats.total_revenue) || 0,
            totalCommissions,
            totalUses: parseInt(usageResult.rows[0]?.total_uses) || 0,
            activeCodesCount: parseInt(activeCodesResult.rows[0]?.count) || 0,
            confirmedBookingsCount: parseInt(bookingStats.confirmed_count) || 0,
            pendingBookingsCount: parseInt(bookingStats.pending_count) || 0,
        };
    }

    /**
     * Get partner's referral codes with pagination
     */
    async getPartnerReferralCodes(
        userId: string,
        paginationDto: PaginationDto,
    ): Promise<PaginatedResult<ReferralCode>> {
        const page = paginationDto.page || 1;
        const limit = paginationDto.limit || 10;
        const offset = (page - 1) * limit;

        // Get total count
        const countResult = await this.db.query(
            `SELECT COUNT(*) as total FROM referral_codes WHERE owner_user_id = $1`,
            [userId],
        );
        const total = parseInt(countResult.rows[0]?.total) || 0;

        // Get paginated codes
        const result = await this.db.query(
            `SELECT 
         id, code, code_type, referral_type,
         agent_commission_type, agent_commission_cents,
         discount_type, discount_value,
         is_active, usage_count, usage_limit, expires_at,
         description, created_at
       FROM referral_codes
       WHERE owner_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
            [userId, limit, offset],
        );

        const data: ReferralCode[] = result.rows.map((row) => ({
            id: row.id,
            code: row.code,
            codeType: row.code_type,
            referralType: row.referral_type,
            agentCommissionType: row.agent_commission_type,
            agentCommissionCents: row.agent_commission_cents,
            discountType: row.discount_type,
            discountValue: row.discount_value,
            isActive: row.is_active,
            usageCount: row.usage_count,
            usageLimit: row.usage_limit,
            expiresAt: row.expires_at,
            description: row.description,
            createdAt: row.created_at,
        }));

        const meta: PaginationMeta = {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page < Math.ceil(total / limit),
            hasPreviousPage: page > 1,
        };

        return { data, meta };
    }

    /**
     * Get detailed statistics for a specific referral code
     */
    async getReferralCodeStats(
        userId: string,
        codeId: string,
    ): Promise<ReferralCodeStats> {
        // Verify ownership
        const codeResult = await this.db.query(
            `SELECT 
         id, code, code_type, referral_type,
         agent_commission_type, agent_commission_cents,
         discount_type, discount_value,
         is_active, usage_count, usage_limit, expires_at,
         description, created_at, owner_user_id
       FROM referral_codes
       WHERE id = $1`,
            [codeId],
        );

        if (codeResult.rows.length === 0) {
            throw new NotFoundException('Referral code not found');
        }

        const codeRow = codeResult.rows[0];

        if (codeRow.owner_user_id !== userId) {
            throw new ForbiddenException('You do not own this referral code');
        }

        // Get booking statistics using booking_referral_codes junction table
        const statsResult = await this.db.query(
            `SELECT 
         COUNT(*) as total_bookings,
         COUNT(*) FILTER (WHERE b.status = 'confirmed') as confirmed_bookings,
         COUNT(*) FILTER (WHERE b.status = 'pending') as pending_bookings,
         COUNT(*) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings,
         COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN b.total_cents ELSE 0 END), 0) as total_revenue,
         MIN(brc.created_at) as first_use,
         MAX(brc.created_at) as last_use
       FROM booking_referral_codes brc
       JOIN bookings b ON b.id = brc.booking_id
       WHERE brc.referral_code_id = $1`,
            [codeId],
        );

        const stats = statsResult.rows[0];

        // Calculate total commissions from confirmed bookings
        let totalCommissions = 0;
        const confirmedBookings = await this.db.query(
            `SELECT b.total_cents FROM booking_referral_codes brc
       JOIN bookings b ON b.id = brc.booking_id
       WHERE brc.referral_code_id = $1 AND b.status = 'confirmed'`,
            [codeId],
        );

        for (const booking of confirmedBookings.rows) {
            if (codeRow.agent_commission_type === 'percentage') {
                totalCommissions += Math.floor(
                    (booking.total_cents * codeRow.agent_commission_cents) / 10000,
                );
            } else {
                totalCommissions += codeRow.agent_commission_cents;
            }
        }

        const totalBookings = parseInt(stats.total_bookings) || 0;
        const confirmedCount = parseInt(stats.confirmed_bookings) || 0;
        const conversionRate = totalBookings > 0 ? (confirmedCount / totalBookings) * 100 : 0;

        return {
            code: {
                id: codeRow.id,
                code: codeRow.code,
                codeType: codeRow.code_type,
                referralType: codeRow.referral_type,
                agentCommissionType: codeRow.agent_commission_type,
                agentCommissionCents: codeRow.agent_commission_cents,
                discountType: codeRow.discount_type,
                discountValue: codeRow.discount_value,
                isActive: codeRow.is_active,
                usageCount: codeRow.usage_count,
                usageLimit: codeRow.usage_limit,
                expiresAt: codeRow.expires_at,
                description: codeRow.description,
                createdAt: codeRow.created_at,
            },
            totalBookings,
            confirmedBookings: confirmedCount,
            pendingBookings: parseInt(stats.pending_bookings) || 0,
            cancelledBookings: parseInt(stats.cancelled_bookings) || 0,
            totalRevenue: parseInt(stats.total_revenue) || 0,
            totalCommissions,
            conversionRate: Math.round(conversionRate * 100) / 100,
            firstUse: stats.first_use,
            lastUse: stats.last_use,
        };
    }

    /**
     * Get bookings that used partner's referral codes with filters
     */
    async getPartnerBookings(
        userId: string,
        paginationDto: PaginationDto,
        filters: BookingFilters,
    ): Promise<PaginatedResult<PartnerBooking>> {
        const page = paginationDto.page || 1;
        const limit = paginationDto.limit || 10;
        const offset = (page - 1) * limit;

        // Build WHERE conditions
        const conditions: string[] = ['rc.owner_user_id = $1'];
        const params: (string | number)[] = [userId];
        let paramIndex = 2;

        if (filters.status) {
            conditions.push(`b.status = $${paramIndex}`);
            params.push(filters.status);
            paramIndex++;
        }

        if (filters.codeId) {
            conditions.push(`rc.id = $${paramIndex}`);
            params.push(filters.codeId);
            paramIndex++;
        }

        if (filters.startDate) {
            conditions.push(`b.created_at >= $${paramIndex}::timestamptz`);
            params.push(filters.startDate);
            paramIndex++;
        }

        if (filters.endDate) {
            conditions.push(`b.created_at <= $${paramIndex}::timestamptz`);
            params.push(filters.endDate);
            paramIndex++;
        }

        const whereClause = conditions.join(' AND ');

        // Get total count
        const countResult = await this.db.query(
            `SELECT COUNT(*) as total 
       FROM booking_referral_codes brc
       JOIN bookings b ON b.id = brc.booking_id
       JOIN referral_codes rc ON brc.referral_code_id = rc.id
       WHERE ${whereClause}`,
            params,
        );
        const total = parseInt(countResult.rows[0]?.total) || 0;

        // Get paginated bookings
        params.push(limit, offset);
        const result = await this.db.query(
            `SELECT 
         b.id, b.status, b.adults, b.children, b.total_cents, b.currency, b.created_at,
         e.title as experience_title, e.id as experience_id,
         r.name as resort_name,
         rc.code as referral_code, rc.id as referral_code_id,
         u.full_name as user_full_name
       FROM booking_referral_codes brc
       JOIN bookings b ON b.id = brc.booking_id
       JOIN referral_codes rc ON brc.referral_code_id = rc.id
       JOIN experiences e ON b.experience_id = e.id
       JOIN resorts r ON e.resort_id = r.id
       JOIN users u ON b.user_id = u.id
       WHERE ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            params,
        );

        const data: PartnerBooking[] = result.rows.map((row) => ({
            id: row.id,
            status: row.status,
            adults: row.adults,
            children: row.children,
            totalCents: row.total_cents,
            currency: row.currency,
            createdAt: row.created_at,
            experienceTitle: row.experience_title,
            experienceId: row.experience_id,
            resortName: row.resort_name,
            referralCode: row.referral_code,
            referralCodeId: row.referral_code_id,
            userFullName: row.user_full_name,
        }));

        const meta: PaginationMeta = {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page < Math.ceil(total / limit),
            hasPreviousPage: page > 1,
        };

        return { data, meta };
    }
}
