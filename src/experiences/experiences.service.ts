/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { PaginationService } from '../common/services/pagination.service';
import { PaginatedResult, PaginationOptions } from '../common/interfaces/pagination.interface';
import { Experience, ExperienceWithImages, ExperienceImage } from './entities/experience.entity';
import {
  CreateExperienceDto,
  UpdateExperienceDto,
  QueryExperiencesDto,
  PresignImageDto,
  PresignedUrlResponse
} from './dto';
import { randomUUID } from 'crypto';

// Interface for PostgreSQL error objects
interface PostgreSQLError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
}

// Type guard to check if error is a PostgreSQL error
function isPostgreSQLError(error: unknown): error is PostgreSQLError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string'
  );
}

@Injectable()
export class ExperiencesService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly paginationService: PaginationService,
  ) {}

  async create(createExperienceDto: CreateExperienceDto): Promise<Experience> {
    const {
      resort_id,
      title,
      description,
      category,
      price_cents,
      currency,
      includes,
      excludes,
      main_image_url,
      status,
    } = createExperienceDto;

    try {
      const result = await this.db.query<Experience>(
        `INSERT INTO experiences (
          resort_id, title, description, category, price_cents, currency,
          includes, excludes, main_image_url, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING *`,
        [
          resort_id,
          title,
          description,
          category,
          price_cents,
          currency,
          includes,
          excludes,
          main_image_url,
          status,
        ],
      );

      return result.rows[0];
    } catch (error: unknown) {
      if (isPostgreSQLError(error) && error.code === '23503') {
        // Foreign key constraint violation
        throw new BadRequestException('Resort not found');
      }
      throw error;
    }
  }

  async findAll(queryDto: QueryExperiencesDto): Promise<PaginatedResult<ExperienceWithImages>> {
    const options: PaginationOptions = {
      page: queryDto.page ?? 1,
      limit: queryDto.limit ?? 10,
      offset: queryDto.offset,
      search: queryDto.search,
      sort: queryDto.sort,
    };

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Search functionality
    if (queryDto.search) {
      const searchClause = this.paginationService.buildSearchClause(
        queryDto.search,
        ['e.title', 'e.description', 'e.includes', 'e.excludes'],
        paramIndex,
      );
      if (searchClause.clause) {
        conditions.push(searchClause.clause.replace('AND ', ''));
        params.push(...searchClause.params);
        paramIndex = searchClause.nextParamIndex;
      }
    }

    // Specific filters
    if (queryDto.resort_id) {
      conditions.push(`e.resort_id = $${paramIndex}`);
      params.push(queryDto.resort_id);
      paramIndex++;
    }

    if (queryDto.category) {
      conditions.push(`e.category = $${paramIndex}`);
      params.push(queryDto.category);
      paramIndex++;
    }

    if (queryDto.status) {
      conditions.push(`e.status = $${paramIndex}`);
      params.push(queryDto.status);
      paramIndex++;
    }

    if (queryDto.min_price !== undefined) {
      conditions.push(`e.price_cents >= $${paramIndex}`);
      params.push(queryDto.min_price);
      paramIndex++;
    }

    if (queryDto.max_price !== undefined) {
      conditions.push(`e.price_cents <= $${paramIndex}`);
      params.push(queryDto.max_price);
      paramIndex++;
    }

    if (queryDto.min_rating !== undefined) {
      conditions.push(`e.rating_avg >= $${paramIndex}`);
      params.push(queryDto.min_rating);
      paramIndex++;
    }

    if (queryDto.currencies && queryDto.currencies.length > 0) {
      const placeholders = queryDto.currencies.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`e.currency IN (${placeholders})`);
      params.push(...queryDto.currencies);
    }

    if (queryDto.has_images === true) {
      conditions.push(`EXISTS (SELECT 1 FROM experience_images ei WHERE ei.experience_id = e.id)`);
    } else if (queryDto.has_images === false) {
      conditions.push(`NOT EXISTS (SELECT 1 FROM experience_images ei WHERE ei.experience_id = e.id)`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build sort options
    const sortOptions = this.paginationService.parseSortOptions(
      queryDto.sort,
      ['title', 'category', 'price_cents', 'rating_avg', 'rating_count', 'created_at', 'updated_at'],
    );
    const orderByClause = this.paginationService.buildOrderByClause(
      sortOptions,
      'e.created_at DESC',
    );

    // Build base query
    const baseQuery = `
      SELECT e.* FROM experiences e 
      ${whereClause} 
      ${orderByClause}
    `;

    const countQuery = `
      SELECT COUNT(*) as count FROM experiences e 
      ${whereClause}
    `;

    // Execute paginated query
    const result = await this.paginationService.executePaginatedQuery<Experience>(
      baseQuery,
      countQuery,
      params,
      options,
    );

    // Include images if requested
    if (queryDto.include_images && result.data.length > 0) {
      const experienceIds = result.data.map(exp => exp.id);
      const images = await this.getExperienceImages(experienceIds);

      const experiencesWithImages: ExperienceWithImages[] = result.data.map(experience => ({
        ...experience,
        images: images.filter(img => img.experience_id === experience.id),
      }));

      return {
        ...result,
        data: experiencesWithImages,
      };
    }

    return result as PaginatedResult<ExperienceWithImages>;
  }

  async findOne(id: string, includeImages = false): Promise<ExperienceWithImages> {
    const result = await this.db.query<Experience>(
      'SELECT * FROM experiences WHERE id = $1',
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Experience not found');
    }

    const experience = result.rows[0];

    if (includeImages) {
      const images = await this.getExperienceImages([id]);
      return {
        ...experience,
        images,
      };
    }

    return experience;
  }

  async findBySlug(resortId: string, slug: string, includeImages = false): Promise<ExperienceWithImages> {
    const result = await this.db.query<Experience>(
      'SELECT * FROM experiences WHERE resort_id = $1 AND slug = $2',
      [resortId, slug],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Experience not found');
    }

    const experience = result.rows[0];

    if (includeImages) {
      const images = await this.getExperienceImages([experience.id]);
      return {
        ...experience,
        images,
      };
    }

    return experience;
  }

  async update(id: string, updateExperienceDto: UpdateExperienceDto): Promise<Experience> {
    const experience = await this.findOne(id);

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    Object.entries(updateExperienceDto).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      return experience;
    }

    params.push(id);

    const result = await this.db.query<Experience>(
      `UPDATE experiences 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      params,
    );

    return result.rows[0];
  }

  async remove(id: string): Promise<void> {
    const result = await this.db.query(
      'DELETE FROM experiences WHERE id = $1',
      [id],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Experience not found');
    }
  }

  async presignImageUpload(
    experienceId: string,
    presignDto: PresignImageDto,
  ): Promise<PresignedUrlResponse> {
    // Verify experience exists
    await this.findOne(experienceId);

    // Generate unique filename
    const fileExtension = this.getFileExtension(presignDto.content_type);
    const uniqueFilename = `experiences/${experienceId}/${randomUUID()}.${fileExtension}`;

    // For now, return a mock presigned URL
    // In production, you would integrate with AWS S3, Google Cloud Storage, etc.
    const mockPresignedUrl = `https://storage.example.com/upload/${uniqueFilename}?expires=3600`;
    const mockImageUrl = `https://storage.example.com/${uniqueFilename}`;

    // Store the image record in database
    await this.db.query(
      `INSERT INTO experience_images (experience_id, url, sort_order) 
       VALUES ($1, $2, $3)`,
      [experienceId, mockImageUrl, presignDto.sort_order || 0],
    );

    return {
      upload_url: mockPresignedUrl,
      image_url: mockImageUrl,
      expires_in: 3600, // 1 hour
    };
  }

  private async getExperienceImages(experienceIds: string[]): Promise<ExperienceImage[]> {
    if (experienceIds.length === 0) return [];

    const placeholders = experienceIds.map((_, index) => `$${index + 1}`).join(', ');

    const result = await this.db.query<ExperienceImage>(
      `SELECT * FROM experience_images 
       WHERE experience_id IN (${placeholders}) 
       ORDER BY experience_id, sort_order ASC`,
      experienceIds,
    );

    return result.rows;
  }

  private getFileExtension(contentType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };

    return extensions[contentType] || 'jpg';
  }
}
