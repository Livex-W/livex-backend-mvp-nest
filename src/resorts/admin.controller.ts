/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
    Controller,
    Get,
    Query,
    Param,
    UseGuards,
    Request,
    Inject,
    NotFoundException,
} from '@nestjs/common';
import { ResortsService } from './resorts.service';
import { AdminResortQueryDto, AdminStatsResponseDto } from './dto/admin-resort.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { CustomLoggerService } from '../common/services/logger.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
    constructor(
        private readonly resortsService: ResortsService,
        private readonly logger: CustomLoggerService,
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    ) { }

    /**
     * Get admin dashboard stats - single endpoint for all stats
     */
    @Get('stats')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async getAdminStats(@Request() req: any): Promise<AdminStatsResponseDto> {
        this.logger.logRequest({
            method: 'GET',
            url: '/api/v1/admin/stats',
            userId: req.user.id,
            role: req.user.role,
        });

        return await this.resortsService.getAdminStats();
    }

    /**
     * Get resorts for admin with filtering capabilities
     */
    @Get('resorts')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async getResorts(@Query() queryDto: AdminResortQueryDto, @Request() req: any) {
        this.logger.logRequest({
            method: 'GET',
            url: '/api/v1/admin/resorts',
            userId: req.user.id,
            role: req.user.role,
            query: queryDto
        });

        return await this.resortsService.findAllForAdmin(queryDto);
    }

    /**
     * Get single resort detail with business_profile for admin
     */
    @Get('resorts/:id')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async getResortDetail(@Param('id') id: string, @Request() req: any) {
        this.logger.logRequest({
            method: 'GET',
            url: `/api/v1/admin/resorts/${id}`,
            userId: req.user.id,
            role: req.user.role,
        });

        // Get resort with business_profile
        const resortQuery = `
            SELECT 
                r.*,
                bp.nit,
                bp.rnt,
                bp.status as bp_status,
                bp.approved_by as bp_approved_by,
                bp.approved_at as bp_approved_at,
                bp.rejection_reason as bp_rejection_reason,
                u.email as owner_email,
                u.phone as owner_phone,
                u.is_active as owner_is_active
            FROM resorts r
            LEFT JOIN business_profiles bp ON r.business_profile_id = bp.id
            LEFT JOIN users u ON r.owner_user_id = u.id
            WHERE r.id = $1
        `;
        const resortResult = await this.db.query(resortQuery, [id]);

        if (resortResult.rows.length === 0) {
            throw new NotFoundException('Resort no encontrado');
        }

        const resort = resortResult.rows[0];

        // Get business documents
        const docsQuery = `
            SELECT bd.*
            FROM business_documents bd
            JOIN business_profiles bp ON bd.business_profile_id = bp.id
            JOIN resorts r ON r.business_profile_id = bp.id
            WHERE r.id = $1
            ORDER BY bd.uploaded_at DESC
        `;
        const docsResult = await this.db.query(docsQuery, [id]);

        return {
            ...resort,
            documents: docsResult.rows,
        };
    }

    /**
     * Get all bookings for admin with filtering capabilities
     */
    @Get('bookings')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async getBookings(@Query() queryDto: PaginationDto, @Request() req: any) {
        this.logger.logRequest({
            method: 'GET',
            url: '/api/v1/admin/bookings',
            userId: req.user.id,
            role: req.user.role,
            query: queryDto
        });

        const { page = 1, limit = 10, search } = queryDto;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const queryParams: unknown[] = [];
        let paramIndex = 1;

        // Search functionality
        if (search) {
            conditions.push(`(
                b.id::text ILIKE $${paramIndex} OR
                e.title ILIKE $${paramIndex} OR
                r.name ILIKE $${paramIndex} OR
                u.full_name ILIKE $${paramIndex} OR
                u.email ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Get total count
        const countQuery = `
            SELECT COUNT(*) FROM bookings b
            LEFT JOIN experiences e ON b.experience_id = e.id
            LEFT JOIN resorts r ON e.resort_id = r.id
            LEFT JOIN users u ON b.user_id = u.id
            ${whereClause}
        `;
        const countResult = await this.db.query(countQuery, queryParams);
        const total = parseInt(countResult.rows[0].count as string);

        // Get paginated results with subquery for experience image
        const dataQuery = `
            SELECT 
                b.*,
                e.title as experience_title,
                (SELECT ei.url FROM experience_images ei WHERE ei.experience_id = e.id AND ei.image_type = 'hero' ORDER BY ei.sort_order LIMIT 1) as experience_image,
                r.name as resort_name,
                r.id as resort_id,
                u.full_name as client_name,
                u.email as client_email,
                u.phone as client_phone
            FROM bookings b
            LEFT JOIN experiences e ON b.experience_id = e.id
            LEFT JOIN resorts r ON e.resort_id = r.id
            LEFT JOIN users u ON b.user_id = u.id
            ${whereClause}
            ORDER BY b.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const dataResult = await this.db.query(dataQuery, [...queryParams, limit, offset]);

        return {
            data: dataResult.rows,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page < Math.ceil(total / limit),
                hasPreviousPage: page > 1,
            },
        };
    }

    /**
     * Get single booking detail for admin
     */
    @Get('bookings/:id')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async getBookingDetail(@Param('id') id: string, @Request() req: any) {
        this.logger.logRequest({
            method: 'GET',
            url: `/api/v1/admin/bookings/${id}`,
            userId: req.user.id,
            role: req.user.role,
        });

        const query = `
            SELECT 
                b.*,
                e.title as experience_title,
                e.description as experience_description,
                e.category as experience_category,
                (SELECT ei.url FROM experience_images ei WHERE ei.experience_id = e.id AND ei.image_type = 'hero' ORDER BY ei.sort_order LIMIT 1) as experience_image,
                r.name as resort_name,
                r.id as resort_id,
                r.city as resort_city,
                owner.phone as resort_phone,
                u.full_name as client_name,
                u.email as client_email,
                u.phone as client_phone,
                agent.full_name as agent_name,
                agent.email as agent_email,
                s.start_time as slot_start_time,
                s.end_time as slot_end_time,
                s.capacity as slot_capacity
            FROM bookings b
            LEFT JOIN experiences e ON b.experience_id = e.id
            LEFT JOIN resorts r ON e.resort_id = r.id
            LEFT JOIN users u ON b.user_id = u.id
            LEFT JOIN users agent ON b.agent_id = agent.id
            LEFT JOIN users owner ON r.owner_user_id = owner.id
            LEFT JOIN availability_slots s ON b.slot_id = s.id
            WHERE b.id = $1
        `;
        const result = await this.db.query(query, [id]);

        if (result.rows.length === 0) {
            throw new NotFoundException('Reserva no encontrada');
        }

        return result.rows[0];
    }

    /**
     * Get all agents for admin with filtering capabilities
     */
    @Get('agents')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async getAgents(@Query() queryDto: PaginationDto, @Request() req: any) {
        this.logger.logRequest({
            method: 'GET',
            url: '/api/v1/admin/agents',
            userId: req.user.id,
            role: req.user.role,
            query: queryDto
        });

        const { page = 1, limit = 10, search } = queryDto;
        const offset = (page - 1) * limit;

        const conditions: string[] = ["u.role = 'agent'"];
        const queryParams: unknown[] = [];
        let paramIndex = 1;

        // Search functionality
        if (search) {
            conditions.push(`(
                u.full_name ILIKE $${paramIndex} OR 
                u.email ILIKE $${paramIndex} OR 
                u.phone ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        // Get total count
        const countQuery = `
            SELECT COUNT(*) FROM users u
            ${whereClause}
        `;
        const countResult = await this.db.query(countQuery, queryParams);
        const total = parseInt(countResult.rows[0].count as string);

        // Get paginated results with resort associations
        const dataQuery = `
            SELECT 
                u.id,
                u.email,
                u.full_name,
                u.avatar,
                u.phone,
                u.document_type,
                u.document_number,
                u.is_active,
                u.created_at,
                (SELECT COUNT(*) FROM resort_agents ra WHERE ra.user_id = u.id AND ra.status = 'approved') as resort_count,
                (SELECT COUNT(*) FROM bookings b WHERE b.agent_id = u.id) as booking_count,
                (SELECT COALESCE(SUM(b.agent_commission_cents), 0) FROM bookings b WHERE b.agent_id = u.id AND b.status = 'confirmed') as total_commission_cents
            FROM users u
            ${whereClause}
            ORDER BY u.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const dataResult = await this.db.query(dataQuery, [...queryParams, limit, offset]);

        return {
            data: dataResult.rows,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page < Math.ceil(total / limit),
                hasPreviousPage: page > 1,
            },
        };
    }

    /**
     * Get single agent detail for admin
     */
    @Get('agents/:id')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async getAgentDetail(@Param('id') id: string, @Request() req: any) {
        this.logger.logRequest({
            method: 'GET',
            url: `/api/v1/admin/agents/${id}`,
            userId: req.user.id,
            role: req.user.role,
        });

        // Get agent user info
        const agentQuery = `
            SELECT 
                u.id,
                u.email,
                u.full_name,
                u.avatar,
                u.phone,
                u.document_type,
                u.document_number,
                u.is_active,
                u.created_at,
                u.updated_at,
                (SELECT COUNT(*) FROM bookings b WHERE b.agent_id = u.id) as total_bookings,
                (SELECT COALESCE(SUM(b.agent_commission_cents), 0) FROM bookings b WHERE b.agent_id = u.id AND b.status = 'confirmed') as total_commission_cents
            FROM users u
            WHERE u.id = $1 AND u.role = 'agent'
        `;
        const agentResult = await this.db.query(agentQuery, [id]);

        if (agentResult.rows.length === 0) {
            throw new NotFoundException('Agente no encontrado');
        }

        const agent = agentResult.rows[0];

        // Get associated resorts
        const resortsQuery = `
            SELECT 
                r.id,
                r.name,
                r.city,
                r.status,
                ra.commission_bps,
                ra.commission_fixed_cents,
                ra.status as ra_status,
                ra.created_at as associated_at
            FROM resort_agents ra
            JOIN resorts r ON ra.resort_id = r.id
            WHERE ra.user_id = $1
            ORDER BY ra.created_at DESC
        `;
        const resortsResult = await this.db.query(resortsQuery, [id]);

        // Get recent bookings
        const bookingsQuery = `
            SELECT 
                b.id,
                b.status,
                b.total_cents,
                b.agent_commission_cents,
                b.created_at,
                e.title as experience_title,
                r.name as resort_name
            FROM bookings b
            JOIN experiences e ON b.experience_id = e.id
            JOIN resorts r ON e.resort_id = r.id
            WHERE b.agent_id = $1
            ORDER BY b.created_at DESC
            LIMIT 10
        `;
        const bookingsResult = await this.db.query(bookingsQuery, [id]);

        // Get referral codes
        const codesQuery = `
            SELECT 
                rc.id,
                rc.code,
                rc.code_type,
                rc.referral_type,
                rc.is_active,
                rc.usage_count,
                rc.discount_type,
                rc.discount_value,
                rc.commission_override_bps,
                rc.created_at
            FROM referral_codes rc
            WHERE rc.owner_user_id = $1
            ORDER BY rc.created_at DESC
        `;
        const codesResult = await this.db.query(codesQuery, [id]);

        return {
            ...agent,
            resorts: resortsResult.rows,
            recent_bookings: bookingsResult.rows,
            referral_codes: codesResult.rows,
        };
    }
}

