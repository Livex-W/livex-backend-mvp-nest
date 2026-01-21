import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { CustomLoggerService } from '../common/services/logger.service';
import { ApproveExperienceDto, RejectExperienceDto } from './dto/approve-experience.dto';
import { ApproveResortDto, RejectResortDto } from '../resorts/dto/approve-resort.dto';
import { Experience } from '../experiences/entities/experience.entity';
import { Resort } from '../resorts/entities/resort.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResult, PaginationMeta } from '../common/interfaces/pagination.interface';
import { NotificationService } from '../notifications/services/notification.service';
import { ConfigService } from '@nestjs/config';

interface PostgreSQLError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly logger: CustomLoggerService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,

  ) { }

  // ========== RESORT MANAGEMENT ==========

  async getResortsForReview(paginationDto: PaginationDto): Promise<PaginatedResult<Resort>> {
    const { page = 1, limit = 10, search } = paginationDto;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE status = 'under_review'";
    const orderClause = 'ORDER BY created_at ASC'; // Oldest first for review queue
    const queryParams: unknown[] = [];

    // Search functionality
    if (search) {
      whereClause += ' AND (name ILIKE $1 OR city ILIKE $1 OR description ILIKE $1)';
      queryParams.push(`%${search}%`);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM resorts ${whereClause}`;
    const countResult = await this.db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count as string);

    // Get paginated results
    const dataQuery = `
      SELECT r.*, u.email as owner_email, u.full_name as owner_name
      FROM resorts r
      LEFT JOIN users u ON r.owner_user_id = u.id
      ${whereClause} 
      ${orderClause} 
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const dataResult = await this.db.query(dataQuery, [...queryParams, limit, offset]);

    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };

    return {
      data: dataResult.rows as Resort[],
      meta,
    };
  }

  async approveResort(id: string, approveDto: ApproveResortDto, adminUserId: string): Promise<Resort> {
    // Check if resort exists and is under review
    const resortResult = await this.db.query('SELECT * FROM resorts WHERE id = $1', [id]);

    if (resortResult.rows.length === 0) {
      throw new NotFoundException('Resort not found');
    }

    const resort = resortResult.rows[0] as Resort;

    if (resort.status !== 'under_review') {
      throw new BadRequestException('Only resorts under review can be approved');
    }

    // Update resort status
    const result = await this.db.query(
      `UPDATE resorts 
       SET status = 'approved', 
           approved_by = $1, 
           approved_at = NOW(),
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $2 
       RETURNING *`,
      [adminUserId, id]
    );

    // Log the action
    this.logger.logBusinessEvent('admin_resort_approved', {
      adminUserId,
      resortId: id,
      resortName: resort.name,
      notes: approveDto.notes
    });

    // Create audit log
    await this.createAuditLog(
      adminUserId,
      'approve',
      'resort',
      id,
      { status: resort.status },
      { status: 'approved', approved_by: adminUserId, notes: approveDto.notes }
    );

    const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');

    await Promise.allSettled([
      this.notificationService.sendResortApprovedAdmin(adminEmail, {
        resortId: resort.id,
        resortName: resort.name,
        ownerEmail: resort.contact_email || "",
        ownerName: resort.name,
      }),

      this.notificationService.sendResortApprovedResort(resort.contact_email || "", {
        resortName: resort.name,
      }),
    ]);


    return result.rows[0] as Resort;
  }

  async rejectResort(id: string, rejectDto: RejectResortDto, adminUserId: string): Promise<Resort> {
    // Check if resort exists and is under review
    const resortResult = await this.db.query('SELECT * FROM resorts WHERE id = $1', [id]);

    if (resortResult.rows.length === 0) {
      throw new NotFoundException('Resort not found');
    }

    const resort = resortResult.rows[0] as Resort;

    if (resort.status !== 'under_review') {
      throw new BadRequestException('Only resorts under review can be rejected');
    }

    // Update resort status
    const result = await this.db.query(
      `UPDATE resorts 
       SET status = 'rejected', 
           approved_by = $1, 
           approved_at = NOW(),
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $3 
       RETURNING *`,
      [adminUserId, rejectDto.rejection_reason, id]
    );

    // Log the action
    this.logger.logBusinessEvent('admin_resort_rejected', {
      adminUserId,
      resortId: id,
      resortName: resort.name,
      rejectionReason: rejectDto.rejection_reason
    });

    // Create audit log
    await this.createAuditLog(
      adminUserId,
      'reject',
      'resort',
      id,
      { status: resort.status },
      { status: 'rejected', rejection_reason: rejectDto.rejection_reason }
    );

    const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');

    await Promise.allSettled([
      this.notificationService.sendResortRejectedAdmin(adminEmail, {
        resortId: resort.id,
        resortName: resort.name,
        ownerEmail: resort.contact_email || "",
        ownerName: resort.name,
        rejectionReason: rejectDto.rejection_reason
      }),

      this.notificationService.sendResortRejectedResort(resort.contact_email || "", {
        resortName: resort.name,
        rejectionReason: rejectDto.rejection_reason
      }),
    ]);

    return result.rows[0] as Resort;
  }

  // ========== DOCUMENT MANAGEMENT ==========

  async approveDocument(id: string, adminUserId: string): Promise<any> {
    // Check if document exists
    const docResult = await this.db.query(
      'SELECT * FROM business_documents WHERE id = $1',
      [id]
    );

    if (docResult.rows.length === 0) {
      throw new NotFoundException('Document not found');
    }

    const document = docResult.rows[0];

    const resortQuery = await this.db.query(
      `SELECT  
        r.id as resort_id,
        bp.name as resort_name,
        u.full_name as owner_name,
        u.email as owner_email
      FROM resorts r
      JOIN business_profiles bp on bp.id = r.business_profile_id
      JOIN users u on u.id = r.owner_user_id
      JOIN business_documents bd on bd.business_profile_id = bp.id
      WHERE bd.id = $1`,
      [document.id]
    );

    const resort = resortQuery.rows[0];

    // Update document status
    const result = await this.db.query(
      `UPDATE business_documents 
       SET status = 'approved', 
           reviewed_by = $1, 
           reviewed_at = NOW(),
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $2 
       RETURNING *`,
      [adminUserId, id]
    );

    // Log the action
    this.logger.logBusinessEvent('admin_document_approved', {
      adminUserId,
      documentId: id,
      docType: document.doc_type,
    });

    // Create audit log
    await this.createAuditLog(
      adminUserId,
      'approve',
      'business_document',
      id,
      { status: document.status },
      { status: 'approved', reviewed_by: adminUserId }
    );


    const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');

    await Promise.allSettled([
      this.notificationService.sendResortApprovedDocumentsAdmin(adminEmail, {
        resortId: resort.resort_id,
        resortName: resort.resort_name,
        ownerEmail: resort.owner_email,
        ownerName: resort.owner_name,
      }),

      this.notificationService.sendResortApprovedDocumentsResort(resort.owner_email || "", {
        resortName: resort.resort_name,
      }),
    ]);


    return result.rows[0];
  }

  async rejectDocument(id: string, rejectionReason: string, adminUserId: string): Promise<any> {
    // Check if document exists
    const docResult = await this.db.query(
      'SELECT * FROM business_documents WHERE id = $1',
      [id]
    );

    if (docResult.rows.length === 0) {
      throw new NotFoundException('Document not found');
    }

    const document = docResult.rows[0];

    const resortQuery = await this.db.query(
      `SELECT  
        r.id as resort_id,
        bp.name as resort_name,
        u.full_name as owner_name,
        u.email as owner_email
      FROM resorts r
      JOIN business_profiles bp on bp.id = r.business_profile_id
      JOIN users u on u.id = r.owner_user_id
      JOIN business_documents bd on bd.business_profile_id = bp.id
      WHERE bd.id = $1`,
      [document.id]
    );

    const resort = resortQuery.rows[0];

    // Update document status
    const result = await this.db.query(
      `UPDATE business_documents 
       SET status = 'rejected', 
           reviewed_by = $1, 
           reviewed_at = NOW(),
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $3 
       RETURNING *`,
      [adminUserId, rejectionReason, id]
    );

    // Log the action
    this.logger.logBusinessEvent('admin_document_rejected', {
      adminUserId,
      documentId: id,
      docType: document.doc_type,
      rejectionReason,
    });

    // Create audit log
    await this.createAuditLog(
      adminUserId,
      'reject',
      'business_document',
      id,
      { status: document.status },
      { status: 'rejected', rejection_reason: rejectionReason }
    );

    const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');

    await Promise.allSettled([
      this.notificationService.sendResortRejectedDocumentsAdmin(adminEmail, {
        resortId: resort.resort_id,
        resortName: resort.resort_name,
        ownerEmail: resort.owner_email || "",
        ownerName: resort.owner_name,
        rejectionReason: rejectionReason
      }),

      this.notificationService.sendResortRejectedDocumentsResort(resort.owner_email || "", {
        resortName: resort.resort_name,
        rejectionReason: rejectionReason
      }),
    ]);

    return result.rows[0];
  }

  // ========== EXPERIENCE MANAGEMENT ==========

  async getExperiencesForReview(paginationDto: PaginationDto): Promise<PaginatedResult<Experience>> {
    const { page = 1, limit = 10, search } = paginationDto;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE e.status = 'under_review'";
    const orderClause = 'ORDER BY e.created_at ASC'; // Oldest first for review queue
    const queryParams: unknown[] = [];

    // Search functionality
    if (search) {
      whereClause += ' AND (e.title ILIKE $1 OR e.description ILIKE $1 OR r.name ILIKE $1)';
      queryParams.push(`%${search}%`);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM experiences e 
      LEFT JOIN resorts r ON e.resort_id = r.id 
      ${whereClause}
    `;
    const countResult = await this.db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count as string);

    // Get paginated results
    const dataQuery = `
      SELECT e.*, r.name as resort_name, r.city as resort_city
      FROM experiences e
      LEFT JOIN resorts r ON e.resort_id = r.id
      ${whereClause} 
      ${orderClause} 
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const dataResult = await this.db.query(dataQuery, [...queryParams, limit, offset]);

    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };

    return {
      data: dataResult.rows as Experience[],
      meta,
    };
  }

  async approveExperience(id: string, approveDto: ApproveExperienceDto, adminUserId: string): Promise<Experience> {
    // Check if experience exists and is under review
    const experienceResult = await this.db.query('SELECT * FROM experiences WHERE id = $1', [id]);

    if (experienceResult.rows.length === 0) {
      throw new NotFoundException('Experience not found');
    }

    const experience = experienceResult.rows[0] as Experience;

    if (experience.status !== 'under_review') {
      throw new BadRequestException('Only experiences under review can be approved');
    }

    // Update experience status
    const result = await this.db.query(
      `UPDATE experiences 
       SET status = 'active', 
           approved_by = $1, 
           approved_at = NOW(),
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $2 
       RETURNING *`,
      [adminUserId, id]
    );

    // Log the action
    this.logger.logBusinessEvent('admin_experience_approved', {
      adminUserId,
      experienceId: id,
      experienceTitle: experience.title,
      notes: approveDto.notes
    });

    // Create audit log
    await this.createAuditLog(
      adminUserId,
      'approve',
      'experience',
      id,
      { status: experience.status },
      { status: 'active', approved_by: adminUserId, notes: approveDto.notes }
    );

    return result.rows[0] as Experience;
  }

  async rejectExperience(id: string, rejectDto: RejectExperienceDto, adminUserId: string): Promise<Experience> {
    // Check if experience exists and is under review
    const experienceResult = await this.db.query('SELECT * FROM experiences WHERE id = $1', [id]);

    if (experienceResult.rows.length === 0) {
      throw new NotFoundException('Experience not found');
    }

    const experience = experienceResult.rows[0] as Experience;

    if (experience.status !== 'under_review') {
      throw new BadRequestException('Only experiences under review can be rejected');
    }

    // Update experience status
    const result = await this.db.query(
      `UPDATE experiences 
       SET status = 'rejected', 
           approved_by = $1, 
           approved_at = NOW(),
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $3 
       RETURNING *`,
      [adminUserId, rejectDto.rejection_reason, id]
    );

    // Log the action
    this.logger.logBusinessEvent('admin_experience_rejected', {
      adminUserId,
      experienceId: id,
      experienceTitle: experience.title,
      rejectionReason: rejectDto.rejection_reason
    });

    // Create audit log
    await this.createAuditLog(
      adminUserId,
      'reject',
      'experience',
      id,
      { status: experience.status },
      { status: 'rejected', rejection_reason: rejectDto.rejection_reason }
    );

    return result.rows[0] as Experience;
  }

  // ========== DASHBOARD & METRICS ==========

  async getDashboardMetrics(adminUserId: string): Promise<any> {
    this.logger.logBusinessEvent('admin_dashboard_accessed', { adminUserId });

    // Get counts for different statuses
    const [
      resortsStats,
      experiencesStats,
      recentActivity
    ] = await Promise.all([
      this.getResortsStats(),
      this.getExperiencesStats(),
      this.getRecentActivity()
    ]);

    return {
      resorts: resortsStats,
      experiences: experiencesStats,
      recentActivity,
      timestamp: new Date().toISOString()
    };
  }

  private async getResortsStats(): Promise<any> {
    const result = await this.db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM resorts 
      GROUP BY status
    `);

    const stats = {
      draft: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
      total: 0
    };

    result.rows.forEach((row: any) => {
      stats[row.status as keyof typeof stats] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });

    return stats;
  }

  private async getExperiencesStats(): Promise<any> {
    const result = await this.db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM experiences 
      GROUP BY status
    `);

    const stats = {
      draft: 0,
      under_review: 0,
      active: 0,
      rejected: 0,
      total: 0
    };

    result.rows.forEach((row: any) => {
      stats[row.status as keyof typeof stats] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });

    return stats;
  }

  private async getRecentActivity(): Promise<any[]> {
    const result = await this.db.query(`
      SELECT 
        action,
        entity_type,
        entity_id,
        after,
        created_at,
        u.email as admin_email
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_user_id = u.id
      WHERE a.action IN ('approve', 'reject')
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    return result.rows;
  }

  // ========== AUDIT LOGGING ==========

  private async createAuditLog(
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    before: any,
    after: any
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO audit_logs (
          actor_user_id, actor_role, action, entity_type, entity_id, 
          before, after, created_at
        ) VALUES ($1, 'admin', $2, $3, $4, $5, $6, NOW())`,
        [
          actorUserId,
          action,
          entityType,
          entityId,
          JSON.stringify(before),
          JSON.stringify(after)
        ]
      );
    } catch (error: unknown) {
      // Log error but don't fail the main operation
      this.logger.logError(error as Error, {
        context: 'audit_log_creation',
        actorUserId,
        action,
        entityType,
        entityId
      });
    }
  }

  async getAuditLogs(paginationDto: PaginationDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20, search } = paginationDto;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const orderClause = 'ORDER BY a.created_at DESC';
    const queryParams: unknown[] = [];

    // Search functionality
    if (search) {
      whereClause = 'WHERE (a.action ILIKE $1 OR a.entity_type ILIKE $1 OR u.email ILIKE $1)';
      queryParams.push(`%${search}%`);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM audit_logs a 
      LEFT JOIN users u ON a.actor_user_id = u.id 
      ${whereClause}
    `;
    const countResult = await this.db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count as string);

    // Get paginated results
    const dataQuery = `
      SELECT 
        a.*,
        u.email as actor_email,
        u.full_name as actor_name
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_user_id = u.id
      ${whereClause} 
      ${orderClause} 
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const dataResult = await this.db.query(dataQuery, [...queryParams, limit, offset]);

    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };

    return {
      data: dataResult.rows,
      meta,
    };
  }
}
