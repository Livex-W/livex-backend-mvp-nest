import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { CustomLoggerService } from '../common/services/logger.service';
import { UploadService } from '../upload/upload.service';
import { CreateResortDto } from './dto/create-resort.dto';
import { UpdateResortDto } from './dto/update-resort.dto';
import { ApproveResortDto, RejectResortDto } from './dto/approve-resort.dto';
import { ResortProfileDto, ResortDocumentDto } from './dto/resort-profile.dto';
import { Resort } from './entities/resort.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResult, PaginationMeta } from '../common/interfaces/pagination.interface';

interface PostgreSQLError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
}

@Injectable()
export class ResortsService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly logger: CustomLoggerService,
    private readonly uploadService: UploadService,
  ) { }

  async create(createResortDto: CreateResortDto, userId: string): Promise<Resort> {
    try {
      this.logger.logBusinessEvent('resort_creation_started', {
        userId,
        resortData: { name: createResortDto.name, city: createResortDto.city }
      });

      // 1. Create business_profile first
      const businessProfileResult = await this.db.query(
        `INSERT INTO business_profiles (
          entity_type, name, nit, rnt, contact_email, contact_phone, status
        ) VALUES ('resort', $1, $2, $3, $4, $5, 'draft')
        RETURNING id`,
        [
          createResortDto.name,
          createResortDto.nit || null,
          createResortDto.rnt || null,
          createResortDto.contact_email || null,
          createResortDto.contact_phone || null,
        ]
      );
      const businessProfileId = businessProfileResult.rows[0].id as string;

      // 2. Create resort with reference to business_profile (NIT/RNT now only in business_profiles)
      const result = await this.db.query(
        `INSERT INTO resorts (
          name, description, contact_email, contact_phone, 
          address_line, city, country, latitude, longitude, 
          owner_user_id, business_profile_id, is_active, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
        RETURNING *`,
        [
          createResortDto.name,
          createResortDto.description || null,
          createResortDto.contact_email || null,
          createResortDto.contact_phone || null,
          createResortDto.address_line || null,
          createResortDto.city || null,
          createResortDto.country || null,
          createResortDto.latitude || null,
          createResortDto.longitude || null,
          userId,
          businessProfileId,
          createResortDto.is_active ?? true,
        ]
      );

      const resort = result.rows[0] as Resort;

      this.logger.logBusinessEvent('resort_created', {
        userId,
        resortId: resort.id,
        resortName: resort.name,
        businessProfileId,
      });

      return resort;
    } catch (error: unknown) {
      const pgError = error as PostgreSQLError;
      this.logger.logError(error as Error, {
        userId,
        resortData: createResortDto
      });

      if (pgError.code === '23505') {
        throw new BadRequestException('Resort with this name already exists');
      }
      throw error;
    }
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<Resort>> {
    const { page = 1, limit = 10, search } = paginationDto;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let orderClause = 'ORDER BY created_at DESC';
    const queryParams: unknown[] = [];

    // Search functionality
    if (search) {
      whereClause = 'WHERE (name ILIKE $1 OR city ILIKE $1 OR description ILIKE $1)';
      queryParams.push(`%${search}%`);
    }

    // Sorting
    const sortParam = paginationDto.sort;
    if (Array.isArray(sortParam) && sortParam.length > 0) {
      const sortString = sortParam[0]; // Take first sort parameter
      if (typeof sortString === 'string' && sortString.includes(':')) {
        const [field, direction] = sortString.split(':');
        const validFields = ['name', 'city', 'status', 'created_at', 'updated_at'];
        const validDirections = ['asc', 'desc'];

        if (validFields.includes(field) && validDirections.includes(direction)) {
          orderClause = `ORDER BY ${field} ${direction.toUpperCase()}`;
        }
      }
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM resorts ${whereClause}`;
    const countResult = await this.db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count as string);

    // Get paginated results
    const dataQuery = `
      SELECT * FROM resorts 
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

  async findOne(id: string): Promise<Resort> {
    const result = await this.db.query('SELECT * FROM resorts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      throw new NotFoundException('Resort not found');
    }

    return result.rows[0] as Resort;
  }

  async findByOwner(userId: string, paginationDto: PaginationDto): Promise<PaginatedResult<Resort>> {
    const { page = 1, limit = 10, search } = paginationDto;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE owner_user_id = $1';
    let orderClause = 'ORDER BY created_at DESC';
    const queryParams: unknown[] = [userId];

    // Search functionality
    if (search) {
      whereClause += ' AND (name ILIKE $2 OR city ILIKE $2 OR description ILIKE $2)';
      queryParams.push(`%${search}%`);
    }

    // Sorting
    const sortParam = paginationDto.sort;
    if (Array.isArray(sortParam) && sortParam.length > 0) {
      const sortString = sortParam[0]; // Take first sort parameter
      if (typeof sortString === 'string' && sortString.includes(':')) {
        const [field, direction] = sortString.split(':');
        const validFields = ['name', 'city', 'status', 'created_at', 'updated_at'];
        const validDirections = ['asc', 'desc'];

        if (validFields.includes(field) && validDirections.includes(direction)) {
          orderClause = `ORDER BY ${field} ${direction.toUpperCase()}`;
        }
      }
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM resorts ${whereClause}`;
    const countResult = await this.db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count as string);

    // Get paginated results
    const dataQuery = `
      SELECT * FROM resorts 
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

  async update(id: string, updateResortDto: UpdateResortDto, userId: string, userRole: string): Promise<Resort> {
    // First check if resort exists and get current data
    const currentResort = await this.findOne(id);

    // Check permissions - only owner or admin can update
    if (userRole !== 'admin' && currentResort.owner_user_id !== userId) {
      throw new ForbiddenException('You can only update your own resorts');
    }

    // Prevent updates if resort is approved (only admin can update approved resorts)
    if (currentResort.status === 'approved' && userRole !== 'admin') {
      throw new BadRequestException('Cannot update approved resort. Contact support for changes.');
    }

    try {
      const updateFields: string[] = [];
      const updateValues: unknown[] = [];
      let paramIndex = 1;

      // Build dynamic update query
      Object.entries(updateResortDto).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        return currentResort;
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id);

      const query = `
        UPDATE resorts 
        SET ${updateFields.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.query(query, updateValues);

      this.logger.logBusinessEvent('resort_updated', {
        userId,
        resortId: id,
        changes: updateResortDto
      });

      return result.rows[0] as Resort;
    } catch (error: unknown) {
      const pgError = error as PostgreSQLError;
      this.logger.logError(error as Error, {
        userId,
        resortId: id,
        updateData: updateResortDto
      });

      if (pgError.code === '23505') {
        throw new BadRequestException('Resort with this name already exists');
      }
      throw error;
    }
  }

  async submitForReview(id: string, userId: string, userRole: string): Promise<Resort> {
    const currentResort = await this.findOne(id);

    // Check permissions
    if (userRole !== 'admin' && currentResort.owner_user_id !== userId) {
      throw new ForbiddenException('You can only submit your own resorts for review');
    }

    // Check current status
    if (currentResort.status !== 'draft') {
      throw new BadRequestException('Only draft resorts can be submitted for review');
    }

    const result = await this.db.query(
      `UPDATE resorts 
       SET status = 'under_review', updated_at = NOW()
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    this.logger.logBusinessEvent('resort_submitted_for_review', {
      userId,
      resortId: id,
      resortName: currentResort.name
    });

    return result.rows[0] as Resort;
  }

  async approve(id: string, approveDto: ApproveResortDto, adminUserId: string): Promise<Resort> {
    const currentResort = await this.findOne(id);

    // Check current status
    if (currentResort.status !== 'under_review') {
      throw new BadRequestException('Only resorts under review can be approved');
    }

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

    this.logger.logBusinessEvent('resort_approved', {
      adminUserId,
      resortId: id,
      resortName: currentResort.name,
      notes: approveDto.notes
    });

    return result.rows[0] as Resort;
  }

  async reject(id: string, rejectDto: RejectResortDto, adminUserId: string): Promise<Resort> {
    const currentResort = await this.findOne(id);

    // Check current status
    if (currentResort.status !== 'under_review') {
      throw new BadRequestException('Only resorts under review can be rejected');
    }

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

    this.logger.logBusinessEvent('resort_rejected', {
      adminUserId,
      resortId: id,
      resortName: currentResort.name,
      rejectionReason: rejectDto.rejection_reason
    });

    return result.rows[0] as Resort;
  }

  async remove(id: string, userId: string, userRole: string): Promise<void> {
    const currentResort = await this.findOne(id);

    // Check permissions - only owner or admin can delete
    if (userRole !== 'admin' && currentResort.owner_user_id !== userId) {
      throw new ForbiddenException('You can only delete your own resorts');
    }

    // Prevent deletion if resort has experiences
    const experiencesResult = await this.db.query(
      'SELECT COUNT(*) FROM experiences WHERE resort_id = $1',
      [id]
    );

    if (parseInt(experiencesResult.rows[0].count as string) > 0) {
      throw new BadRequestException('Cannot delete resort with existing experiences');
    }

    await this.db.query('DELETE FROM resorts WHERE id = $1', [id]);

    this.logger.logBusinessEvent('resort_deleted', {
      userId,
      resortId: id,
      resortName: currentResort.name
    });
  }

  async findProfileByOwner(userId: string): Promise<ResortProfileDto | null> {
    // Get the resort owned by this user with business_profile data
    const resortResult = await this.db.query(
      `SELECT r.*, 
              bp.nit, 
              bp.rnt,
              bp.status as bp_status
       FROM resorts r
       LEFT JOIN business_profiles bp ON r.business_profile_id = bp.id
       WHERE r.owner_user_id = $1 
       LIMIT 1`,
      [userId]
    );

    if (resortResult.rows.length === 0) {
      return null;
    }

    const resort = resortResult.rows[0];
    const resortId = resort.id as string;
    const businessProfileId = resort.business_profile_id as string | null;

    // Get documents from business_documents (no legacy fallback)
    let documentsResult = { rows: [] as Record<string, unknown>[] };
    if (businessProfileId) {
      documentsResult = await this.db.query(
        `SELECT id, doc_type, file_url, status, rejection_reason, reviewed_at, uploaded_at, created_at, updated_at
         FROM business_documents 
         WHERE business_profile_id = $1 
         ORDER BY created_at DESC`,
        [businessProfileId]
      );
    }

    // Get agents with user info
    const agentsResult = await this.db.query(
      `SELECT ra.id, ra.resort_id, ra.user_id, ra.commission_bps, ra.is_active, ra.created_at, ra.updated_at,
              u.email as agent_email, u.full_name as agent_name
       FROM resort_agents ra
       LEFT JOIN users u ON ra.user_id = u.id
       WHERE ra.resort_id = $1 
       ORDER BY ra.created_at DESC`,
      [resortId]
    );

    // NIT/RNT from business_profile only
    const nit = resort.nit as string | undefined;
    const rnt = resort.rnt as string | undefined;

    const profile: ResortProfileDto = {
      id: resort.id as string,
      name: resort.name as string,
      description: resort.description as string | undefined,
      website: resort.website as string | undefined,
      contact_email: resort.contact_email as string | undefined,
      contact_phone: resort.contact_phone as string | undefined,
      address_line: resort.address_line as string | undefined,
      city: resort.city as string | undefined,
      country: resort.country as string | undefined,
      nit,
      rnt,
      latitude: resort.latitude as number | undefined,
      longitude: resort.longitude as number | undefined,
      owner_user_id: resort.owner_user_id as string,
      is_active: resort.is_active as boolean,
      status: resort.status as ResortProfileDto['status'],
      approved_by: resort.approved_by as string | undefined,
      approved_at: resort.approved_at ? (resort.approved_at as Date).toISOString() : undefined,
      rejection_reason: resort.rejection_reason as string | undefined,
      created_at: (resort.created_at as Date).toISOString(),
      updated_at: (resort.updated_at as Date).toISOString(),
      documents: documentsResult.rows.map((doc) => ({
        id: doc.id as string,
        doc_type: doc.doc_type as ResortDocumentDto['doc_type'],
        file_url: doc.file_url as string,
        status: doc.status as ResortDocumentDto['status'],
        rejection_reason: doc.rejection_reason as string | undefined,
        reviewed_at: doc.reviewed_at ? (doc.reviewed_at as Date).toISOString() : undefined,
        uploaded_at: (doc.uploaded_at as Date).toISOString(),
        created_at: (doc.created_at as Date).toISOString(),
        updated_at: (doc.updated_at as Date).toISOString(),
      })),
      agents: agentsResult.rows.map((agent) => ({
        id: agent.id as string,
        resort_id: agent.resort_id as string | undefined,
        user_id: agent.user_id as string,
        commission_bps: agent.commission_bps as number,
        is_active: agent.is_active as boolean,
        agent_email: agent.agent_email as string | undefined,
        agent_name: agent.agent_name as string | undefined,
        created_at: (agent.created_at as Date).toISOString(),
        updated_at: (agent.updated_at as Date).toISOString(),
      })),
    };

    this.logger.logBusinessEvent('resort_profile_fetched', {
      userId,
      resortId,
      businessProfileId,
      documentsCount: profile.documents.length,
      agentsCount: profile.agents.length,
    });

    return profile;
  }

  // ==================== Document Management ====================

  async createDocument(
    resortId: string,
    docType: string,
    fileUrl: string,
    userId: string,
    userRole: string
  ): Promise<ResortDocumentDto> {
    // Verify ownership or admin
    const resort = await this.findOne(resortId);
    if (userRole !== 'admin' && resort.owner_user_id !== userId) {
      throw new ForbiddenException('You do not have permission to add documents to this resort');
    }

    const businessProfileId = resort.business_profile_id;

    // Resort must have a business_profile to upload documents
    if (!businessProfileId) {
      throw new BadRequestException('Resort does not have a business profile configured');
    }

    // Check if document of this type already exists in business_documents
    const existingDoc = await this.db.query(
      'SELECT id FROM business_documents WHERE business_profile_id = $1 AND doc_type = $2',
      [businessProfileId, docType]
    );

    let doc;
    if (existingDoc.rows.length > 0) {
      // Update existing document
      const result = await this.db.query(
        `UPDATE business_documents 
         SET file_url = $1, status = 'uploaded', uploaded_at = now(), updated_at = now()
         WHERE business_profile_id = $2 AND doc_type = $3
         RETURNING *`,
        [fileUrl, businessProfileId, docType]
      );
      doc = result.rows[0];
      this.logger.logBusinessEvent('business_document_updated', { resortId, businessProfileId, docType, userId });
    } else {
      // Create new document
      const result = await this.db.query(
        `INSERT INTO business_documents (business_profile_id, doc_type, file_url, status, uploaded_at)
         VALUES ($1, $2, $3, 'uploaded', now())
         RETURNING *`,
        [businessProfileId, docType, fileUrl]
      );
      doc = result.rows[0];
      this.logger.logBusinessEvent('business_document_created', { resortId, businessProfileId, docType, userId });
    }

    return {
      id: doc.id as string,
      doc_type: doc.doc_type as ResortDocumentDto['doc_type'],
      file_url: doc.file_url as string,
      status: doc.status as ResortDocumentDto['status'],
      rejection_reason: doc.rejection_reason as string | undefined,
      reviewed_at: doc.reviewed_at ? (doc.reviewed_at as Date).toISOString() : undefined,
      uploaded_at: (doc.uploaded_at as Date).toISOString(),
      created_at: (doc.created_at as Date).toISOString(),
      updated_at: (doc.updated_at as Date).toISOString(),
    };
  }

  async deleteDocument(
    resortId: string,
    docId: string,
    userId: string,
    userRole: string
  ): Promise<void> {
    // Verify ownership or admin
    const resort = await this.findOne(resortId);
    if (userRole !== 'admin' && resort.owner_user_id !== userId) {
      throw new ForbiddenException('You do not have permission to delete documents from this resort');
    }

    const businessProfileId = resort.business_profile_id;
    if (!businessProfileId) {
      throw new BadRequestException('Resort does not have a business profile configured');
    }

    // Get document record from business_documents
    const docResult = await this.db.query<{ id: string; file_url: string }>(
      'SELECT id, file_url FROM business_documents WHERE id = $1 AND business_profile_id = $2',
      [docId, businessProfileId]
    );

    if (docResult.rows.length === 0) {
      throw new NotFoundException('Document not found');
    }

    const document = docResult.rows[0];

    // Extract blob name from URL and delete from S3
    const blobName = this.uploadService.extractBlobNameFromUrl(document.file_url);
    if (blobName) {
      try {
        await this.uploadService.deleteFile('', blobName);
        this.logger.logBusinessEvent('business_document_file_deleted', { resortId, docId, blobName });
      } catch (error) {
        // Log error but don't fail the operation if blob doesn't exist
        console.warn(`Failed to delete blob ${blobName}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Remove from database
    await this.db.query(
      'DELETE FROM business_documents WHERE id = $1',
      [docId]
    );

    this.logger.logBusinessEvent('business_document_deleted', { resortId, docId, userId });
  }

  /**
   * Upload a document file directly to S3 and save the record in resort_documents table.
   * Structure: docs/{resortSlug}/{docType}/{timestamp}-{uuid}.{extension}
   */
  async uploadDocument(
    resortId: string,
    docType: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    userId: string,
    userRole: string
  ): Promise<{ document_url: string; document: ResortDocumentDto }> {
    // Verify ownership or admin
    const resort = await this.findOne(resortId);
    if (userRole !== 'admin' && resort.owner_user_id !== userId) {
      throw new ForbiddenException('You do not have permission to upload documents to this resort');
    }

    // Validate file
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type (images + PDF)
    if (!this.uploadService.validateDocumentType(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only images and PDF files are allowed.');
    }

    // Generate resort slug for path structure
    const resortSlug = this.uploadService.generateSlug(resort.name);

    // Generate professional blob path under docs/ folder
    const blobPath = this.uploadService.generateDocumentBlobPath(
      resortSlug,
      docType,
      file.originalname || 'document',
    );

    // Upload file directly to S3
    const documentUrl = await this.uploadService.uploadFile(
      '', // containerName not used, goes to main bucket
      blobPath,
      file.buffer,
      file.mimetype,
    );

    // Save the document record in database using existing createDocument logic
    const documentRecord = await this.createDocument(
      resortId,
      docType,
      documentUrl,
      userId,
      userRole,
    );

    this.logger.logBusinessEvent('resort_document_uploaded', {
      resortId,
      docType,
      userId,
      documentUrl,
      fileSize: file.buffer.length,
    });

    return {
      document_url: documentUrl,
      document: documentRecord,
    };
  }

  // ==================== Reviews Management ====================

  async getReviewsByResort(resortId: string): Promise<{
    reviews: {
      id: string;
      experience_id: string;
      user_id: string | null;
      booking_id: string | null;
      rating: number;
      comment: string | null;
      created_at: string;
      user_full_name: string | null;
      user_avatar: string | null;
      experience_title: string;
    }[];
    stats: {
      average_rating: number;
      total_reviews: number;
      reviews_this_month: number;
    };
  }> {
    // Verify resort exists
    await this.findOne(resortId);

    // Fetch reviews with user and experience info
    const reviewsResult = await this.db.query(`
      SELECT r.id, r.experience_id, r.user_id, r.booking_id, r.rating, r.comment, r.created_at,
             u.full_name as user_full_name, 
             u.avatar as user_avatar,
             e.title as experience_title
      FROM reviews r
      INNER JOIN experiences e ON r.experience_id = e.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE e.resort_id = $1
      ORDER BY r.created_at DESC
    `, [resortId]);

    // Get aggregate stats
    const statsResult = await this.db.query(`
      SELECT 
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(r.id) as total_reviews,
        COUNT(CASE WHEN r.created_at >= date_trunc('month', CURRENT_DATE) THEN 1 END) as reviews_this_month
      FROM reviews r
      INNER JOIN experiences e ON r.experience_id = e.id
      WHERE e.resort_id = $1
    `, [resortId]);

    const statsRow = statsResult.rows[0];

    this.logger.logBusinessEvent('resort_reviews_fetched', {
      resortId,
      reviewsCount: reviewsResult.rows.length,
    });

    return {
      reviews: reviewsResult.rows.map((row) => ({
        id: row.id as string,
        experience_id: row.experience_id as string,
        user_id: row.user_id as string | null,
        booking_id: row.booking_id as string | null,
        rating: row.rating as number,
        comment: row.comment as string | null,
        created_at: (row.created_at as Date).toISOString(),
        user_full_name: row.user_full_name as string | null,
        user_avatar: row.user_avatar as string | null,
        experience_title: row.experience_title as string,
      })),
      stats: {
        average_rating: parseFloat(statsRow?.average_rating as string) || 0,
        total_reviews: parseInt(statsRow?.total_reviews as string) || 0,
        reviews_this_month: parseInt(statsRow?.reviews_this_month as string) || 0,
      }
    };
  }

  // ==================== Resort Statistics ====================

  async getResortStats(userId: string): Promise<{
    summary: {
      totalBookingsMonth: number;
      totalRevenueCentsMonth: number;
      totalResortNetCentsMonth: number;
      totalGuestsMonth: number;
      checkedInMonth: number;
      pendingCheckIn: number;
    };
    comparison: {
      revenueChangePercent: number;
      bookingsChangePercent: number;
      guestsChangePercent: number;
    };
    topExperiences: {
      id: string;
      title: string;
      bookings: number;
      revenue_cents: number;
    }[];
    dailyBreakdown: {
      date: string;
      bookings: number;
      revenue_cents: number;
      guests: number;
    }[];
    bookingsBySource: {
      source: string;
      count: number;
      revenue_cents: number;
    }[];
    bookingsByStatus: {
      status: string;
      count: number;
    }[];
  }> {
    // Get resort ID for this user
    const resortResult = await this.db.query<{ id: string }>(
      'SELECT id FROM resorts WHERE owner_user_id = $1 LIMIT 1',
      [userId]
    );

    if (resortResult.rows.length === 0) {
      throw new NotFoundException('No resort found for this user');
    }

    const resortId = resortResult.rows[0].id;
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Current month summary
    const summaryResult = await this.db.query<{
      total_bookings: string;
      total_revenue_cents: string;
      total_resort_net_cents: string;
      total_guests: string;
      checked_in_count: string;
    }>(`
      SELECT 
        COUNT(b.id) as total_bookings,
        COALESCE(SUM(b.total_cents), 0) as total_revenue_cents,
        COALESCE(SUM(b.resort_net_cents), 0) as total_resort_net_cents,
        COALESCE(SUM(b.adults + b.children), 0) as total_guests,
        COUNT(CASE WHEN b.checked_in_at IS NOT NULL THEN 1 END) as checked_in_count
      FROM bookings b
      JOIN experiences e ON e.id = b.experience_id
      WHERE e.resort_id = $1 
        AND b.status IN ('confirmed', 'pending')
        AND b.created_at >= $2
    `, [resortId, firstDayOfMonth.toISOString()]);

    const summary = summaryResult.rows[0];

    // Pending check-ins (confirmed bookings without check_in)
    const pendingCheckInResult = await this.db.query<{ count: string }>(`
      SELECT COUNT(b.id) as count
      FROM bookings b
      JOIN experiences e ON e.id = b.experience_id
      WHERE e.resort_id = $1 
        AND b.status = 'confirmed'
        AND b.checked_in_at IS NULL
    `, [resortId]);

    // Last month for comparison
    const lastMonthResult = await this.db.query<{
      total_bookings: string;
      total_revenue_cents: string;
      total_guests: string;
    }>(`
      SELECT 
        COUNT(b.id) as total_bookings,
        COALESCE(SUM(b.total_cents), 0) as total_revenue_cents,
        COALESCE(SUM(b.adults + b.children), 0) as total_guests
      FROM bookings b
      JOIN experiences e ON e.id = b.experience_id
      WHERE e.resort_id = $1 
        AND b.status IN ('confirmed', 'pending')
        AND b.created_at >= $2
        AND b.created_at <= $3
    `, [resortId, firstDayOfLastMonth.toISOString(), lastDayOfLastMonth.toISOString()]);

    const lastMonth = lastMonthResult.rows[0];

    // Calculate comparison percentages
    const currentRevenue = parseInt(summary.total_revenue_cents) || 0;
    const lastRevenue = parseInt(lastMonth?.total_revenue_cents) || 0;
    const currentBookings = parseInt(summary.total_bookings) || 0;
    const lastBookings = parseInt(lastMonth?.total_bookings) || 0;
    const currentGuests = parseInt(summary.total_guests) || 0;
    const lastGuests = parseInt(lastMonth?.total_guests) || 0;

    const revenueChangePercent = lastRevenue > 0
      ? Math.round(((currentRevenue - lastRevenue) / lastRevenue) * 100)
      : currentRevenue > 0 ? 100 : 0;
    const bookingsChangePercent = lastBookings > 0
      ? Math.round(((currentBookings - lastBookings) / lastBookings) * 100)
      : currentBookings > 0 ? 100 : 0;
    const guestsChangePercent = lastGuests > 0
      ? Math.round(((currentGuests - lastGuests) / lastGuests) * 100)
      : currentGuests > 0 ? 100 : 0;

    // Top 5 experiences by revenue this month
    const topExperiencesResult = await this.db.query<{
      id: string;
      title: string;
      bookings: string;
      revenue_cents: string;
    }>(`
      SELECT 
        e.id,
        e.title,
        COUNT(b.id) as bookings,
        COALESCE(SUM(b.resort_net_cents), 0) as revenue_cents
      FROM experiences e
      LEFT JOIN bookings b ON b.experience_id = e.id 
        AND b.status IN ('confirmed', 'pending')
        AND b.created_at >= $2
      WHERE e.resort_id = $1
      GROUP BY e.id, e.title
      ORDER BY revenue_cents DESC
      LIMIT 5
    `, [resortId, firstDayOfMonth.toISOString()]);

    // Daily breakdown for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyResult = await this.db.query<{
      date: string;
      bookings: string;
      revenue_cents: string;
      guests: string;
    }>(`
      SELECT 
        DATE(b.created_at) as date,
        COUNT(b.id) as bookings,
        COALESCE(SUM(b.resort_net_cents), 0) as revenue_cents,
        COALESCE(SUM(b.adults + b.children), 0) as guests
      FROM bookings b
      JOIN experiences e ON e.id = b.experience_id
      WHERE e.resort_id = $1 
        AND b.status IN ('confirmed', 'pending')
        AND b.created_at >= $2
      GROUP BY DATE(b.created_at)
      ORDER BY date ASC
    `, [resortId, sevenDaysAgo.toISOString()]);

    // Bookings by source
    const sourceResult = await this.db.query<{
      source: string;
      count: string;
      revenue_cents: string;
    }>(`
      SELECT 
        b.booking_source as source,
        COUNT(b.id) as count,
        COALESCE(SUM(b.resort_net_cents), 0) as revenue_cents
      FROM bookings b
      JOIN experiences e ON e.id = b.experience_id
      WHERE e.resort_id = $1 
        AND b.status IN ('confirmed', 'pending')
        AND b.created_at >= $2
      GROUP BY b.booking_source
    `, [resortId, firstDayOfMonth.toISOString()]);

    // Bookings by status (all time for context)
    const statusResult = await this.db.query<{
      status: string;
      count: string;
    }>(`
      SELECT 
        b.status,
        COUNT(b.id) as count
      FROM bookings b
      JOIN experiences e ON e.id = b.experience_id
      WHERE e.resort_id = $1
      GROUP BY b.status
    `, [resortId]);

    this.logger.logBusinessEvent('resort_stats_fetched', {
      userId,
      resortId,
      month: now.toISOString().slice(0, 7),
    });

    return {
      summary: {
        totalBookingsMonth: parseInt(summary.total_bookings) || 0,
        totalRevenueCentsMonth: parseInt(summary.total_revenue_cents) || 0,
        totalResortNetCentsMonth: parseInt(summary.total_resort_net_cents) || 0,
        totalGuestsMonth: parseInt(summary.total_guests) || 0,
        checkedInMonth: parseInt(summary.checked_in_count) || 0,
        pendingCheckIn: parseInt(pendingCheckInResult.rows[0]?.count) || 0,
      },
      comparison: {
        revenueChangePercent,
        bookingsChangePercent,
        guestsChangePercent,
      },
      topExperiences: topExperiencesResult.rows.map(row => ({
        id: row.id,
        title: row.title,
        bookings: parseInt(row.bookings) || 0,
        revenue_cents: parseInt(row.revenue_cents) || 0,
      })),
      dailyBreakdown: dailyResult.rows.map(row => ({
        date: row.date,
        bookings: parseInt(row.bookings) || 0,
        revenue_cents: parseInt(row.revenue_cents) || 0,
        guests: parseInt(row.guests) || 0,
      })),
      bookingsBySource: sourceResult.rows.map(row => ({
        source: row.source,
        count: parseInt(row.count) || 0,
        revenue_cents: parseInt(row.revenue_cents) || 0,
      })),
      bookingsByStatus: statusResult.rows.map(row => ({
        status: row.status,
        count: parseInt(row.count) || 0,
      })),
    };
  }
}
