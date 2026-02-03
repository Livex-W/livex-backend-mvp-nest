import {
    Inject,
    Injectable,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
    BadRequestException,
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
import { UploadService } from '../upload/upload.service';
import { NotificationService } from '../notifications/services/notification.service';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class AgentsService {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
        private readonly usersService: UsersService,
        private readonly passwordHashService: PasswordHashService,
        private readonly uploadService: UploadService,
        private readonly notificationService: NotificationService,
        private readonly configService: ConfigService,
    ) { }

    async createAgent(dto: CreateAgentDto, requesterId: string) {
        // 1. Find Resort owned by requester (Resort Owner)
        let resortId: string | null = null;

        // Only if requester is provided. If admin creates? Assuming this flow is for Resort Owner.
        // User feedback implies checking ownership.
        const resortRes = await this.db.query(
            'SELECT id, name as resort_name FROM resorts WHERE owner_user_id = $1 LIMIT 1',
            [requesterId]
        );
        const resortName = resortRes.rows[0]?.resort_name;
        console.log(`Resort name: ${resortName}`);

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

        // 5. Create resort_agents relationship with business_profile reference and status='draft'
        await this.db.query(
            `INSERT INTO resort_agents (resort_id, user_id, business_profile_id, commission_bps, commission_fixed_cents, status)
                VALUES ($1, $2, $3, $4, $5, 'draft')
                ON CONFLICT (resort_id, user_id) DO UPDATE SET
                    business_profile_id = EXCLUDED.business_profile_id,
                    status = 'draft',
                    updated_at = NOW()`,
            [resortId, newUser.id, businessProfileId, dto.commissionBps || 0, dto.commissionFixedCents || 0],
        );

        const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');

        // 6. Send notification to admin
        this.notificationService.sendAgentCreatedNotifyAdmin(adminEmail, {
            resortName: resortName || '',
            agentName: dto.fullName,
        });

        this.notificationService.sendAgentCreatedNotifyAgent(newUser.email, {
            resortName: resortName || '',
            agentName: dto.fullName,
            agentEmail: dto.email,
            agentPassword: dto.password,
        });

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

        const resultQuery = await this.db.query(
            `SELECT 
                    r.name as resortName, 
                    u.full_name as agentName,
                    u.email as agentEmail
                FROM resorts r 
                JOIN resort_agents ra ON r.id = ra.resort_id 
                JOIN users u ON ra.user_id = u.id 
                WHERE ra.user_id = $1`,
            [dto.userId],
        );

        const resortName = resultQuery.rows[0].resortName;
        const agentName = resultQuery.rows[0].agentName;
        const agentEmail = resultQuery.rows[0].agentEmail;
        const adminEmail = this.configService.get('ADMIN_EMAIL', 'admin@livex.com');

        this.notificationService.sendAgentVinculatedNotifyAdmin(adminEmail, {
            resortName,
            agentName,
        });

        this.notificationService.sendAgentVinculatedNotifyAgent(agentEmail, {
            resortName,
            agentName,
        });

        try {
            const result = await this.db.query(
                `INSERT INTO resort_agents (resort_id, user_id, commission_bps, commission_fixed_cents, status)
         VALUES ($1, $2, $3, $4, 'draft')
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

        // Enhanced data query with additional agent info
        const dataQuery = `
            SELECT 
                u.id, 
                u.email, 
                u.full_name, 
                u.avatar,
                u.phone,
                u.created_at,
                (SELECT COUNT(*) FROM resort_agents ra2 WHERE ra2.user_id = u.id AND ra2.status = 'approved') as approved_resorts_count,
                (SELECT COUNT(*) FROM resort_agents ra3 WHERE ra3.user_id = u.id AND ra3.status = 'rejected') as rejected_resorts_count,
                (SELECT COUNT(*) FROM resort_agents ra4 WHERE ra4.user_id = u.id AND ra4.status = 'draft') as pending_resorts_count,
                (SELECT COUNT(*) FROM resort_agents ra5 WHERE ra5.user_id = u.id) as total_resorts_count,
                (SELECT COUNT(*) FROM bookings b WHERE b.agent_id = u.id AND b.status = 'confirmed') as total_bookings,
                bp.nit,
                bp.rnt,
                bp.status as business_status
            FROM users u
            LEFT JOIN resort_agents ra ON u.id = ra.user_id AND ra.resort_id = $1
            LEFT JOIN business_profiles bp ON bp.id = (
                SELECT ra_bp.business_profile_id 
                FROM resort_agents ra_bp 
                WHERE ra_bp.user_id = u.id AND ra_bp.business_profile_id IS NOT NULL 
                LIMIT 1
            )
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

    async getAgentsByResort(resortId: string, requesterId: string, statusFilter?: string) {
        const isOwner = await this.checkResortOwnership(resortId, requesterId);
        if (!isOwner) {
            throw new ConflictException('You do not have permission to view agents for this resort');
        }

        let query = `
            SELECT ra.*, u.email, u.full_name, u.phone,
                   bp.nit, bp.rnt, bp.status as business_status
            FROM resort_agents ra
            JOIN users u ON u.id = ra.user_id
            LEFT JOIN business_profiles bp ON bp.id = ra.business_profile_id
            WHERE ra.resort_id = $1
        `;
        const params: (string | undefined)[] = [resortId];

        if (statusFilter) {
            query += ` AND ra.status = $2`;
            params.push(statusFilter);
        }

        query += ` ORDER BY ra.created_at DESC`;

        const result = await this.db.query(query, params);

        // Fetch documents for each agent with business_profile
        const agentsWithDocs = await Promise.all(
            result.rows.map(async (agent: { business_profile_id?: string }) => {
                if (agent.business_profile_id) {
                    const docsResult = await this.db.query(
                        `SELECT id, doc_type, file_url, status, rejection_reason, uploaded_at
                         FROM business_documents
                         WHERE business_profile_id = $1
                         ORDER BY created_at DESC`,
                        [agent.business_profile_id]
                    );
                    return { ...agent, documents: docsResult.rows };
                }
                return { ...agent, documents: [] };
            })
        );

        return agentsWithDocs;
    }

    async approveAgent(resortId: string, userId: string, requesterId: string) {
        const isOwner = await this.checkResortOwnership(resortId, requesterId);
        if (!isOwner) {
            throw new ConflictException('You do not have permission to approve agents');
        }

        const result = await this.db.query(
            `UPDATE resort_agents
             SET status = 'approved', 
                 approved_by = $1,
                 approved_at = NOW(),
                 rejection_reason = NULL,
                 updated_at = NOW()
             WHERE resort_id = $2 AND user_id = $3
             RETURNING *`,
            [requesterId, resortId, userId],
        );

        if (result.rows.length === 0) {
            throw new NotFoundException('Agent not found');
        }

        const resultQuery = await this.db.query(
            `SELECT 
              r.name as resort_name, 
              u.full_name as agent_name,
              u.email as agent_email
            FROM resort_agents ra
            JOIN resorts r ON r.id = ra.resort_id 
            JOIN users u ON ra.user_id = u.id 
            WHERE ra.user_id = $1 AND ra.resort_id = $2`,
            [userId, resortId],
        );


        if (resultQuery.rows.length === 0) {
            throw new NotFoundException('Agent information not found');
        }

        const { resort_name, agent_name, agent_email } = resultQuery.rows[0];

        const adminEmail = this.configService.get('ADMIN_EMAIL', 'admin@livex.com');

        this.notificationService.sendAgentApprovedNotifyAgent(agent_email, {
            resortName: resort_name,
            agentName: agent_name,
        });

        this.notificationService.sendAgentApprovedNotifyAdmin(adminEmail, {
            resortName: resort_name,
            agentName: agent_name,
        });


        return result.rows[0];
    }

    async rejectAgent(resortId: string, userId: string, reason: string, requesterId: string) {
        const isOwner = await this.checkResortOwnership(resortId, requesterId);
        if (!isOwner) {
            throw new ConflictException('You do not have permission to reject agents');
        }

        const result = await this.db.query(
            `UPDATE resort_agents
             SET status = 'rejected', 
                 approved_by = $1,
                 approved_at = NOW(),
                 rejection_reason = $2,
                 updated_at = NOW()
             WHERE resort_id = $3 AND user_id = $4
             RETURNING *`,
            [requesterId, reason, resortId, userId],
        );

        if (result.rows.length === 0) {
            throw new NotFoundException('Agent not found');
        }

        const resultQuery = await this.db.query(
            `SELECT 
              r.name as resort_name, 
              u.full_name as agent_name,
              u.email as agent_email
            FROM resort_agents ra
            JOIN resorts r ON r.id = ra.resort_id 
            JOIN users u ON ra.user_id = u.id 
            WHERE ra.user_id = $1 AND ra.resort_id = $2`,
            [userId, resortId],
        );


        if (resultQuery.rows.length === 0) {
            throw new NotFoundException('Agent information not found');
        }

        const { resort_name, agent_name, agent_email } = resultQuery.rows[0];

        const adminEmail = this.configService.get('ADMIN_EMAIL', 'admin@livex.com');

        this.notificationService.sendAgentRejectedNotifyAgent(agent_email, {
            resortName: resort_name,
            agentName: agent_name,
            reason: reason,
        });

        this.notificationService.sendAgentRejectedNotifyAdmin(adminEmail, {
            resortName: resort_name,
            agentName: agent_name,
            reason: reason,
        });


        return result.rows[0];
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

    async getAgentResorts(userId: string) {
        const result = await this.db.query<{
            id: string;
            name: string;
            city: string | null;
            country: string | null;
        }>(
            `SELECT r.id, r.name, r.city, r.country
             FROM resorts r
             INNER JOIN resort_agents ra ON ra.resort_id = r.id
             WHERE ra.user_id = $1 AND ra.is_active = true AND ra.status = 'approved'
             ORDER BY r.name ASC`,
            [userId],
        );

        return { resorts: result.rows };
    }

    // ===== Document Upload =====

    async uploadDocument(
        userId: string,
        file: { buffer: Buffer; originalname: string; mimetype: string },
        docType: string,
    ): Promise<{ document: { id: string; doc_type: string; file_url: string; status: string; uploaded_at: string } }> {
        // Get business profile from any resort_agents record for this user
        const raResult = await this.db.query<{ business_profile_id: string | null }>(`
            SELECT business_profile_id FROM resort_agents 
            WHERE user_id = $1 AND business_profile_id IS NOT NULL 
            LIMIT 1
        `, [userId]);

        let businessProfileId: string;

        if (raResult.rows.length > 0 && raResult.rows[0].business_profile_id) {
            businessProfileId = raResult.rows[0].business_profile_id;
        } else {
            // Get user info to create business profile
            const userResult = await this.db.query<{ full_name: string; email: string }>(`
                SELECT full_name, email FROM users WHERE id = $1
            `, [userId]);

            if (userResult.rows.length === 0) {
                throw new NotFoundException('User not found');
            }

            const user = userResult.rows[0];

            // Create business profile for the agent
            const createBpResult = await this.db.query<{ id: string }>(`
                INSERT INTO business_profiles (entity_type, name, contact_email, status)
                VALUES ('agent', $1, $2, 'draft')
                RETURNING id
            `, [user.full_name, user.email]);

            businessProfileId = createBpResult.rows[0].id;

            // Link the business profile to the first resort_agent record
            await this.db.query(`
                UPDATE resort_agents SET business_profile_id = $1 
                WHERE user_id = $2 AND business_profile_id IS NULL
            `, [businessProfileId, userId]);
        }

        // Validate file
        if (!file || !file.buffer) {
            throw new BadRequestException('No file provided');
        }

        // Validate file type
        if (!this.uploadService.validateDocumentType(file.mimetype)) {
            throw new BadRequestException('Invalid file type. Only images and PDF files are allowed.');
        }

        // Generate blob path
        const blobPath = this.uploadService.generateDocumentBlobPath(
            `agent-${userId.slice(0, 8)}`,
            docType,
            file.originalname || 'document',
        );

        // Upload to S3
        const fileUrl = await this.uploadService.uploadFile('', blobPath, file.buffer, file.mimetype);

        // Check if document of this type already exists
        const existingDoc = await this.db.query(
            'SELECT id FROM business_documents WHERE business_profile_id = $1 AND doc_type = $2',
            [businessProfileId, docType],
        );

        let doc;
        if (existingDoc.rows.length > 0) {
            // Update existing
            const result = await this.db.query(
                `UPDATE business_documents 
                 SET file_url = $1, status = 'uploaded', uploaded_at = now(), updated_at = now()
                 WHERE business_profile_id = $2 AND doc_type = $3
                 RETURNING *`,
                [fileUrl, businessProfileId, docType],
            );
            doc = result.rows[0];
        } else {
            // Create new
            const result = await this.db.query(
                `INSERT INTO business_documents (business_profile_id, doc_type, file_url, status, uploaded_at)
                 VALUES ($1, $2, $3, 'uploaded', now())
                 RETURNING *`,
                [businessProfileId, docType, fileUrl],
            );
            doc = result.rows[0];
        }

        const resultQuery = await this.db.query(
            `SELECT 
              r.name as resort_name, 
              u.full_name as agent_name,
              r.contact_email as resort_email
            FROM resorts r 
            JOIN resort_agents ra ON r.id = ra.resort_id 
            JOIN users u ON ra.user_id = u.id 
            WHERE ra.user_id = $1`,
            [userId],
        );

        const resortEmail = resultQuery.rows[0].resort_email;
        const resortName = resultQuery.rows[0].resort_name;
        const agentName = resultQuery.rows[0].agent_name;

        this.notificationService.sendAgentUnderReviewNotifytoResort(resortEmail, {
            resortName: resortName,
            agentName: agentName,
        });

        return {
            document: {
                id: doc.id,
                doc_type: doc.doc_type,
                file_url: doc.file_url,
                status: doc.status,
                uploaded_at: doc.uploaded_at?.toISOString?.() ?? doc.uploaded_at,
            },
        };
    }

    async deleteDocument(userId: string, docId: string): Promise<void> {
        // Get business profile from resort_agents for this user
        const raResult = await this.db.query<{ business_profile_id: string | null }>(`
            SELECT business_profile_id FROM resort_agents 
            WHERE user_id = $1 AND business_profile_id IS NOT NULL 
            LIMIT 1
        `, [userId]);

        if (raResult.rows.length === 0 || !raResult.rows[0].business_profile_id) {
            throw new NotFoundException('Business profile not found');
        }

        const businessProfileId = raResult.rows[0].business_profile_id;

        // Get document
        const docResult = await this.db.query<{ id: string; file_url: string }>(
            'SELECT id, file_url FROM business_documents WHERE id = $1 AND business_profile_id = $2',
            [docId, businessProfileId],
        );

        if (docResult.rows.length === 0) {
            throw new NotFoundException('Document not found');
        }

        const document = docResult.rows[0];

        // Delete from S3
        const blobName = this.uploadService.extractBlobNameFromUrl(document.file_url);
        if (blobName) {
            try {
                await this.uploadService.deleteFile('', blobName);
            } catch (error) {
                console.warn(`Failed to delete blob ${blobName}:`, error instanceof Error ? error.message : 'Unknown');
            }
        }

        // Delete from database
        await this.db.query('DELETE FROM business_documents WHERE id = $1', [docId]);
    }

    // ===== Document Approval/Rejection by Resort =====

    async approveDocument(
        resortId: string,
        docId: string,
        requesterId: string,
    ): Promise<{ id: string; status: string }> {
        // Check resort ownership
        await this.checkResortOwnership(resortId, requesterId);

        // Verify the document belongs to an agent of this resort
        const docCheck = await this.db.query<{
            id: string,
            agentName: string;
            agentEmail: string;
            resortName: string;
        }>(`
            SELECT bd.id, 
            u.full_name as "agentName",
            u.email as "agentEmail",
            r.name as "resortName" FROM business_documents bd
            JOIN resort_agents ra ON ra.business_profile_id = bd.business_profile_id
            JOIN users u ON ra.user_id = u.id
            JOIN resorts r ON ra.resort_id = r.id
            WHERE bd.id = $1 AND ra.resort_id = $2
        `, [docId, resortId]);

        if (docCheck.rows.length === 0) {
            throw new NotFoundException('Document not found or does not belong to an agent of this resort');
        }

        const result = await this.db.query<{ id: string; status: string }>(`
            UPDATE business_documents 
            SET status = 'approved', reviewed_at = now(), updated_at = now()
            WHERE id = $1
            RETURNING id, status
        `, [docId]);


        const { agentName, agentEmail, resortName } = docCheck.rows[0];
        const adminEmail = this.configService.get('ADMIN_EMAIL', 'admin@livex.com');

        this.notificationService.sendAgentApprovedDocumentsNotifyAgent(agentEmail,
            {
                agentName: agentName,
            }
        );

        this.notificationService.sendAgentApprovedDocumentsNotifyAdmin(adminEmail, {
            resortName: resortName,
            agentName: agentName,
        });

        return result.rows[0];
    }

    async rejectDocument(
        resortId: string,
        docId: string,
        rejectionReason: string,
        requesterId: string,
    ): Promise<{ id: string; status: string; rejection_reason: string }> {
        // Check resort ownership
        await this.checkResortOwnership(resortId, requesterId);

        // Verify the document belongs to an agent of this resort
        const docCheck = await this.db.query<{
            id: string,
            agentName: string;
            agentEmail: string;
            resortName: string;
        }>(`
            SELECT bd.id, 
            u.full_name as "agentName",
            u.email as "agentEmail",
            r.name as "resortName" 
            FROM business_documents bd
            JOIN resort_agents ra ON ra.business_profile_id = bd.business_profile_id
            JOIN users u ON ra.user_id = u.id
            JOIN resorts r ON ra.resort_id = r.id
            WHERE bd.id = $1 AND ra.resort_id = $2
        `, [docId, resortId]);

        if (docCheck.rows.length === 0) {
            throw new NotFoundException('Document not found or does not belong to an agent of this resort');
        }

        const result = await this.db.query<{ id: string; status: string; rejection_reason: string }>(`
            UPDATE business_documents 
            SET status = 'rejected', rejection_reason = $1, reviewed_at = now(), updated_at = now()
            WHERE id = $2
            RETURNING id, status, rejection_reason
        `, [rejectionReason, docId]);


        const { agentName, agentEmail, resortName } = docCheck.rows[0];
        const adminEmail = this.configService.get('ADMIN_EMAIL', 'admin@livex.com');

        this.notificationService.sendAgentRejectedDocumentsNotifyAgent(agentEmail,
            {
                agentName: agentName,
                reason: rejectionReason,
            }
        );

        this.notificationService.sendAgentRejectedDocumentsNotifyAdmin(adminEmail, {
            resortName: resortName,
            agentName: agentName,
            reason: rejectionReason,
        });

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
