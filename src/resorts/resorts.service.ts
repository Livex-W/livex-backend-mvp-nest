import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { CustomLoggerService } from '../common/services/logger.service';
import { CreateResortDto } from './dto/create-resort.dto';
import { UpdateResortDto } from './dto/update-resort.dto';
import { ApproveResortDto, RejectResortDto } from './dto/approve-resort.dto';
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
  ) {}

  async create(createResortDto: CreateResortDto, userId: string): Promise<Resort> {
    try {
      this.logger.logBusinessEvent('resort_creation_started', {
        userId,
        resortData: { name: createResortDto.name, city: createResortDto.city }
      });

      const result = await this.db.query(
        `INSERT INTO resorts (
          name, description, contact_email, contact_phone, 
          address_line, city, country, latitude, longitude, 
          owner_user_id, is_active, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft')
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
          createResortDto.is_active ?? true,
        ]
      );

      const resort = result.rows[0] as Resort;
      
      this.logger.logBusinessEvent('resort_created', {
        userId,
        resortId: resort.id,
        resortName: resort.name
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
}
