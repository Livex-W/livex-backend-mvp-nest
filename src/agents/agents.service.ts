import {
    Inject,
    Injectable,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { CreateAgentAgreementDto } from './dto/create-agent-agreement.dto';
import { UpdateAgentCommissionDto } from './dto/update-agent-commission.dto';
import { UpdateAgentProfileDto } from './dto/update-agent-profile.dto';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';
import { AddCodeRestrictionDto } from './dto/add-code-restriction.dto';
import { CreateCodeVariantDto } from './dto/create-code-variant.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UsersService } from '../users/users.service';
import { PasswordHashService } from '../auth/services/password-hash.service';
@Injectable()
export class AgentsService {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
        private readonly usersService: UsersService,
        private readonly passwordHashService: PasswordHashService,
    ) { }

    async createAgent(dto: CreateAgentDto, requesterId: string) {
        // 1. Find Resort owned by requester (Resort Owner)
        let resortId: string | null = null;

        // Only if requester is provided. If admin creates? Assuming this flow is for Resort Owner.
        // User feedback implies checking ownership.
        const resortRes = await this.db.query(
            'SELECT id FROM resorts WHERE owner_user_id = $1 LIMIT 1',
            [requesterId]
        );

        if (resortRes.rows.length > 0) {
            resortId = resortRes.rows[0].id as string;
        }

        // 2. Check if user exists
        const existingUser = await this.usersService.findByEmail(dto.email);
        if (existingUser) {
            throw new ConflictException('User already exists with this email');
        }

        // 3. Create User
        const passwordHash = this.passwordHashService.hashPassword(dto.password);
        const newUser = await this.usersService.createUser({
            email: dto.email,
            passwordHash,
            fullName: dto.fullName,
            role: 'agent',
            phone: dto.phone,
            documentType: dto.documentType,
            documentNumber: dto.documentNumber,
        });

        // 4. Create business_profile for the agent
        const businessProfileResult = await this.db.query(
            `INSERT INTO business_profiles (
                entity_type, name, nit, rnt, contact_email, contact_phone, status
            ) VALUES ('agent', $1, $2, $3, $4, $5, 'draft')
            RETURNING id`,
            [
                `${dto.fullName} - Agente`,
                dto.nit || null,
                dto.rnt || null,
                dto.email,
                dto.phone,
            ]
        );
        const businessProfileId = businessProfileResult.rows[0].id as string;

        // 5. Create resort_agents relationship with business_profile reference
        await this.db.query(
            `INSERT INTO resort_agents (resort_id, user_id, business_profile_id, commission_bps, commission_fixed_cents)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (resort_id, user_id) DO UPDATE SET
                    business_profile_id = EXCLUDED.business_profile_id,
                    updated_at = NOW()`,
            [resortId, newUser.id, businessProfileId, dto.commissionBps || 0, dto.commissionFixedCents || 0],
        );

        return {
            ...newUser,
            resortId,
            businessProfileId,
            commissionBps: dto.commissionBps || 0,
            commissionFixedCents: dto.commissionFixedCents || 0,
        };
    }

    private async checkResortOwnership(resortId: string, userId: string) {
        const result = await this.db.query(
            'SELECT owner_user_id FROM resorts WHERE id = $1',
            [resortId],
        );

        if (result.rows.length === 0) {
            throw new NotFoundException('Resort not found');
        }

        if (result.rows[0].owner_user_id !== userId) {
            // Check if user is admin (optional, assuming role check is done elsewhere or we check DB)
            // For now strict ownership
            // throw new ForbiddenException('You do not own this resort');
            // To avoid importing ForbiddenException if not used often, or just return false
        }
        return result.rows[0].owner_user_id === userId;
    }

    async createAgreement(resortId: string, dto: CreateAgentAgreementDto, requesterId: string) {
        const isOwner = await this.checkResortOwnership(resortId, requesterId);
        if (!isOwner) {
            // We can throw here
            throw new ConflictException('You do not have permission to manage agents for this resort');
        }

        // Check if user exists
        const userResult = await this.db.query(
            'SELECT id FROM users WHERE id = $1',
            [dto.userId],
        );
        if (userResult.rows.length === 0) {
            throw new NotFoundException('User not found');
        }

        try {
            const result = await this.db.query(
                `INSERT INTO resort_agents (resort_id, user_id, commission_bps, commission_fixed_cents)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
                [resortId, dto.userId, dto.commissionBps, dto.commissionFixedCents || 0],
            );
            return result.rows[0];
        } catch (error) {
            const pgError = error as { code?: string };
            if (pgError.code === '23505') { // unique_violation
                throw new ConflictException('Agent already has an agreement with this resort');
            }
            throw new InternalServerErrorException('Failed to create agent agreement');
        }
    }

    async searchUnassignedAgents(resortId: string, search: string, page: number = 1, limit: number = 10) {
        const offset = (page - 1) * limit;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM users u
            LEFT JOIN resort_agents ra ON u.id = ra.user_id AND ra.resort_id = $1
            WHERE ra.id IS NULL 
            AND u.role = 'agent'
            ${search ? 'AND (u.email ILIKE $2 OR u.full_name ILIKE $2)' : ''}
        `;

        const dataQuery = `
            SELECT u.id, u.email, u.full_name, u.avatar 
            FROM users u
            LEFT JOIN resort_agents ra ON u.id = ra.user_id AND ra.resort_id = $1
            WHERE ra.id IS NULL 
            AND u.role = 'agent'
            ${search ? 'AND (u.email ILIKE $2 OR u.full_name ILIKE $2)' : ''}
            ORDER BY u.created_at DESC
            LIMIT $${search ? '3' : '2'} OFFSET $${search ? '4' : '3'}
        `;

        const countParams = search ? [resortId, `%${search}%`] : [resortId];
        const dataParams = search ? [resortId, `%${search}%`, limit, offset] : [resortId, limit, offset];

        const [countResult, dataResult] = await Promise.all([
            this.db.query(countQuery, countParams),
            this.db.query(dataQuery, dataParams)
        ]);

        return {
            data: dataResult.rows,
            meta: {
                total: parseInt(countResult.rows[0].total, 10),
                page,
                limit,
                total_pages: Math.ceil(parseInt(countResult.rows[0].total, 10) / limit),
            }
        };
    }

    async getAgentsByResort(resortId: string, requesterId: string) {
        const isOwner = await this.checkResortOwnership(resortId, requesterId);
        if (!isOwner) {
            throw new ConflictException('You do not have permission to view agents for this resort');
        }

        const result = await this.db.query(
            `SELECT ra.*, u.email, u.full_name
       FROM resort_agents ra
       JOIN users u ON u.id = ra.user_id
       WHERE ra.resort_id = $1`,
            [resortId],
        );
        return result.rows;
    }

    async updateCommission(resortId: string, userId: string, dto: UpdateAgentCommissionDto, requesterId: string) {
        const isOwner = await this.checkResortOwnership(resortId, requesterId);
        if (!isOwner) {
            throw new ConflictException('You do not have permission to manage agents for this resort');
        }

        const result = await this.db.query(
            `UPDATE resort_agents
       SET commission_bps = $1, updated_at = NOW()
       WHERE resort_id = $2 AND user_id = $3
       RETURNING *`,
            [dto.commissionBps, resortId, userId],
        );

        if (result.rows.length === 0) {
            throw new NotFoundException('Agent agreement not found');
        }

        return result.rows[0];
    }

    async getAgentCommissions(agentId: string) {
        const result = await this.db.query(
            `SELECT ac.*, r.name as resort_name, b.total_cents as booking_total_cents
       FROM agent_commissions ac
       JOIN resorts r ON r.id = ac.resort_id
       JOIN bookings b ON b.id = ac.booking_id
       WHERE ac.agent_id = $1
       ORDER BY ac.created_at DESC`,
            [agentId],
        );
        return result.rows;
    }

    async getAgentStats(agentId: string) {
        const result = await this.db.query(
            `SELECT 
            COUNT(*) as total_sales,
            COALESCE(SUM(amount_cents), 0) as total_earnings_cents,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_cents ELSE 0 END), 0) as pending_earnings_cents,
            COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_cents ELSE 0 END), 0) as paid_earnings_cents
           FROM agent_commissions
           WHERE agent_id = $1`,
            [agentId]
        );
        return result.rows[0];
    }

    async getProfile(userId: string) {
        // Get agent profile via resort_agents and business_profile data
        const result = await this.db.query(
            `SELECT ra.id, ra.user_id, ra.business_profile_id, ra.commission_bps, ra.commission_fixed_cents,
                    u.full_name, u.email, u.phone,
                    bp.nit, 
                    bp.rnt,
                    bp.status as business_status
             FROM resort_agents ra
             JOIN users u ON u.id = ra.user_id
             LEFT JOIN business_profiles bp ON ra.business_profile_id = bp.id
             WHERE ra.user_id = $1
             LIMIT 1`,
            [userId],
        );

        if (result.rows.length === 0) {
            // Agent not linked to any resort yet, return basic user info
            const userResult = await this.db.query(
                'SELECT id, full_name, email, phone FROM users WHERE id = $1',
                [userId]
            );
            if (userResult.rows.length === 0) return null;
            return {
                user_id: userId,
                ...userResult.rows[0],
                documents: [],
            };
        }

        const profile = result.rows[0] as { business_profile_id?: string };
        const businessProfileId = profile.business_profile_id;

        // Get business documents if business_profile exists
        let documents: unknown[] = [];
        if (businessProfileId) {
            const docsResult = await this.db.query(
                `SELECT id, doc_type, file_url, status, rejection_reason, reviewed_at, uploaded_at, created_at, updated_at
                 FROM business_documents 
                 WHERE business_profile_id = $1 
                 ORDER BY created_at DESC`,
                [businessProfileId]
            );
            documents = docsResult.rows;
        }

        return {
            ...profile,
            documents,
        };
    }

    async updateProfile(userId: string, dto: UpdateAgentProfileDto) {
        // Check if user has resort_agents entry and get business_profile_id
        const existingProfile = await this.db.query(
            'SELECT id, business_profile_id FROM resort_agents WHERE user_id = $1 LIMIT 1',
            [userId]
        );

        let businessProfileId = existingProfile.rows[0]?.business_profile_id as string | null;
        const resortAgentId = existingProfile.rows[0]?.id as string | undefined;

        // If NIT or RNT is provided, upsert business_profile
        if (dto.nit !== undefined || dto.rnt !== undefined) {
            if (businessProfileId) {
                // Update existing business_profile
                await this.db.query(
                    `UPDATE business_profiles 
                     SET nit = COALESCE($1, nit), 
                         rnt = COALESCE($2, rnt),
                         updated_at = NOW()
                     WHERE id = $3`,
                    [dto.nit ?? null, dto.rnt ?? null, businessProfileId]
                );
            } else {
                // Get user info for business_profile name
                const userResult = await this.db.query(
                    'SELECT full_name, email, phone FROM users WHERE id = $1',
                    [userId]
                );
                const user = userResult.rows[0] as { full_name?: string; email?: string; phone?: string } | undefined;

                // Create new business_profile
                const newBpResult = await this.db.query(
                    `INSERT INTO business_profiles (
                        entity_type, name, nit, rnt, contact_email, contact_phone, status
                    ) VALUES ('agent', $1, $2, $3, $4, $5, 'draft')
                    RETURNING id`,
                    [
                        `${user?.full_name || 'Agent'} - Agente`,
                        dto.nit ?? null,
                        dto.rnt ?? null,
                        user?.email ?? null,
                        user?.phone ?? null,
                    ]
                );
                businessProfileId = newBpResult.rows[0].id as string;

                // Link to resort_agents if exists
                if (resortAgentId) {
                    await this.db.query(
                        'UPDATE resort_agents SET business_profile_id = $1 WHERE id = $2',
                        [businessProfileId, resortAgentId]
                    );
                }
            }
        }

        // Return updated profile
        const bpResult = await this.db.query(
            'SELECT nit, rnt, status FROM business_profiles WHERE id = $1',
            [businessProfileId]
        );

        return {
            user_id: userId,
            business_profile_id: businessProfileId,
            nit: bpResult.rows[0]?.nit ?? null,
            rnt: bpResult.rows[0]?.rnt ?? null,
            business_status: bpResult.rows[0]?.status ?? null,
        };
    }

    // ===== Referral Codes =====

    async createReferralCode(userId: string, dto: CreateReferralCodeDto) {
        // Verificar que el código no exista
        const existing = await this.db.query(
            'SELECT id FROM referral_codes WHERE UPPER(code) = UPPER($1)',
            [dto.code],
        );

        if (existing.rows.length > 0) {
            throw new ConflictException('Referral code already exists');
        }

        const result = await this.db.query(
            `INSERT INTO referral_codes (
                owner_user_id, code, code_type, discount_type, discount_value,
                commission_override_bps, usage_limit, expires_at, description,
                allow_stacking, min_purchase_cents, max_discount_cents
            ) VALUES ($1, UPPER($2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
                userId,
                dto.code,
                dto.codeType ?? 'commission',
                dto.discountType ?? null,
                dto.discountValue ?? 0,
                dto.commissionOverrideBps ?? null,
                dto.usageLimit ?? null,
                dto.expiresAt ?? null,
                dto.description ?? null,
                dto.allowStacking ?? false,
                dto.minPurchaseCents ?? 0,
                dto.maxDiscountCents ?? null,
            ],
        );

        return result.rows[0];
    }

    async getMyReferralCodes(userId: string) {
        const result = await this.db.query(
            `SELECT * FROM referral_codes 
             WHERE owner_user_id = $1 
             ORDER BY created_at DESC`,
            [userId],
        );
        return result.rows;
    }

    async validateReferralCode(code: string) {
        const result = await this.db.query(
            `SELECT * FROM referral_codes 
             WHERE UPPER(code) = UPPER($1) 
             AND is_active = true
             AND (expires_at IS NULL OR expires_at > NOW())
             AND (usage_limit IS NULL OR usage_count < usage_limit)`,
            [code],
        );

        if (result.rows.length === 0) {
            throw new NotFoundException('Invalid or expired referral code');
        }

        return result.rows[0];
    }

    async incrementCodeUsage(codeId: string) {
        await this.db.query(
            'UPDATE referral_codes SET usage_count = usage_count + 1 WHERE id = $1',
            [codeId],
        );
    }

    async toggleReferralCode(userId: string, codeId: string, isActive: boolean) {
        const result = await this.db.query(
            `UPDATE referral_codes 
             SET is_active = $1, updated_at = NOW()
             WHERE id = $2 AND owner_user_id = $3
             RETURNING *`,
            [isActive, codeId, userId],
        );

        if (result.rows.length === 0) {
            throw new NotFoundException('Referral code not found');
        }

        return result.rows[0];
    }

    // ===== Restricciones =====

    async addCodeRestriction(userId: string, codeId: string, dto: AddCodeRestrictionDto) {
        // Verificar ownership
        const code = await this.db.query(
            'SELECT owner_user_id FROM referral_codes WHERE id = $1',
            [codeId],
        );

        if (code.rows.length === 0 || code.rows[0].owner_user_id !== userId) {
            throw new NotFoundException('Referral code not found or unauthorized');
        }

        const result = await this.db.query(
            `INSERT INTO referral_code_restrictions (
                referral_code_id, restriction_type, experience_id, category_slug, resort_id
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [
                codeId,
                dto.restrictionType,
                dto.experienceId ?? null,
                dto.categorySlug ?? null,
                dto.resortId ?? null,
            ],
        );

        return result.rows[0];
    }

    async getCodeRestrictions(codeId: string) {
        const result = await this.db.query(
            'SELECT * FROM referral_code_restrictions WHERE referral_code_id = $1',
            [codeId],
        );
        return result.rows;
    }

    async removeCodeRestriction(userId: string, restrictionId: string) {
        const result = await this.db.query(
            `DELETE FROM referral_code_restrictions 
             WHERE id = $1 
             AND referral_code_id IN (
                 SELECT id FROM referral_codes WHERE owner_user_id = $2
             )
             RETURNING *`,
            [restrictionId, userId],
        );

        if (result.rows.length === 0) {
            throw new NotFoundException('Restriction not found or unauthorized');
        }

        return result.rows[0];
    }

    // ===== A/B Testing - Variantes =====

    async createCodeVariant(userId: string, parentCodeId: string, dto: CreateCodeVariantDto) {
        // Verificar ownership del código padre
        const parentCode = await this.db.query(
            'SELECT owner_user_id, code_type, discount_type FROM referral_codes WHERE id = $1',
            [parentCodeId],
        );

        if (parentCode.rows.length === 0 || parentCode.rows[0].owner_user_id !== userId) {
            throw new NotFoundException('Parent code not found or unauthorized');
        }

        // Verificar que el código de la variante no exista
        const existing = await this.db.query(
            'SELECT id FROM referral_code_variants WHERE UPPER(code) = UPPER($1)',
            [dto.code],
        );

        if (existing.rows.length > 0) {
            throw new ConflictException('Variant code already exists');
        }

        const result = await this.db.query(
            `INSERT INTO referral_code_variants (
                parent_code_id, variant_name, code, discount_value, commission_override_bps
            ) VALUES ($1, $2, UPPER($3), $4, $5)
            RETURNING *`,
            [
                parentCodeId,
                dto.variantName,
                dto.code,
                dto.discountValue ?? null,
                dto.commissionOverrideBps ?? null,
            ],
        );

        return result.rows[0];
    }

    async getCodeVariants(parentCodeId: string) {
        const result = await this.db.query(
            `SELECT * FROM referral_code_variants 
             WHERE parent_code_id = $1 
             ORDER BY created_at ASC`,
            [parentCodeId],
        );
        return result.rows;
    }

    async toggleCodeVariant(userId: string, variantId: string, isActive: boolean) {
        const result = await this.db.query(
            `UPDATE referral_code_variants v
             SET is_active = $1
             FROM referral_codes rc
             WHERE v.id = $2 
             AND v.parent_code_id = rc.id
             AND rc.owner_user_id = $3
             RETURNING v.*`,
            [isActive, variantId, userId],
        );

        if (result.rows.length === 0) {
            throw new NotFoundException('Variant not found or unauthorized');
        }

        return result.rows[0];
    }

    // ===== Analytics =====

    async getCodeAnalytics(userId: string, codeId?: string) {
        let query = `
            SELECT * FROM v_referral_code_analytics 
            WHERE owner_user_id = $1
        `;
        const params: any[] = [userId];

        if (codeId) {
            query += ' AND code_id = $2';
            params.push(codeId);
        }

        query += ' ORDER BY total_revenue_cents DESC';

        const result = await this.db.query(query, params);
        return result.rows;
    }

    async getVariantAnalytics(userId: string, parentCodeId: string) {
        // Verificar ownership
        const code = await this.db.query(
            'SELECT owner_user_id FROM referral_codes WHERE id = $1',
            [parentCodeId],
        );

        if (code.rows.length === 0 || code.rows[0].owner_user_id !== userId) {
            throw new NotFoundException('Code not found or unauthorized');
        }

        const result = await this.db.query(
            `SELECT 
                v.id,
                v.variant_name,
                v.code,
                v.usage_count,
                v.conversion_count,
                CASE 
                    WHEN v.usage_count > 0 
                    THEN ROUND((v.conversion_count::numeric / v.usage_count::numeric) * 100, 2)
                    ELSE 0 
                END as conversion_rate_pct,
                v.discount_value,
                v.commission_override_bps,
                v.is_active,
                v.created_at
             FROM referral_code_variants v
             WHERE v.parent_code_id = $1
             ORDER BY v.conversion_rate_pct DESC, v.usage_count DESC`,
            [parentCodeId],
        );

        return result.rows;
    }
}
