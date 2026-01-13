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

        await this.db.query(
            `INSERT INTO resort_agents (resort_id, user_id, commission_bps, commission_fixed_cents)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (resort_id, user_id) DO NOTHING`,
            [resortId, newUser.id, dto.commissionBps || 0, dto.commissionFixedCents || 0],
        );

        return {
            ...newUser,
            resortId,
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
                `INSERT INTO resort_agents (resort_id, user_id, commission_bps)
         VALUES ($1, $2, $3)
         RETURNING *`,
                [resortId, dto.userId, dto.commissionBps],
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
        const result = await this.db.query(
            `SELECT * FROM agent_profiles WHERE user_id = $1`,
            [userId],
        );
        return result.rows[0] || null;
    }

    async updateProfile(userId: string, dto: UpdateAgentProfileDto) {
        // Upsert profile
        const result = await this.db.query(
            `INSERT INTO agent_profiles (
         user_id, bank_name, account_number, account_type, account_holder_name, tax_id, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         bank_name = EXCLUDED.bank_name,
         account_number = EXCLUDED.account_number,
         account_type = EXCLUDED.account_type,
         account_holder_name = EXCLUDED.account_holder_name,
         tax_id = EXCLUDED.tax_id,
         updated_at = NOW()
       RETURNING *`,
            [
                userId,
                dto.bankName ?? null,
                dto.accountNumber ?? null,
                dto.accountType ?? null,
                dto.accountHolderName ?? null,
                dto.taxId ?? null,
            ],
        );
        return result.rows[0];
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
