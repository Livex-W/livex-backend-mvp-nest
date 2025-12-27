import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { PaginationService } from '../common/services/pagination.service';
import { CustomLoggerService } from '../common/services/logger.service';
import { PaginatedResult, PaginationOptions } from '../common/interfaces/pagination.interface';
import { Experience, ExperienceWithImages, ExperienceImage } from './entities/experience.entity';
import {
  CreateExperienceDto,
  UpdateExperienceDto,
  QueryExperiencesDto,
  PresignImageDto,
  PresignedUrlResponse,
  ExperienceImageType,
  CreateReviewDto
} from './dto';
import { Review } from './entities/experience.entity';
import { UploadService, PresignedUrlOptions } from '../upload/upload.service';
// Removed randomUUID import as we now use professional naming structure

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
    private readonly uploadService: UploadService,
    private readonly logger: CustomLoggerService,
  ) { }

  async create(createExperienceDto: CreateExperienceDto): Promise<Experience> {
    const {
      resort_id,
      title,
      description,
      category,
      price_cents,
      commission_cents,
      currency,
      includes,
      excludes,
      main_image_url,
      status,
    } = createExperienceDto;

    try {
      const result = await this.db.query<Experience>(
        `INSERT INTO experiences (
          resort_id, title, description, category, price_cents, commission_cents, currency,
          includes, excludes, main_image_url, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
        RETURNING *`,
        [
          resort_id,
          title,
          description,
          category,
          price_cents,
          commission_cents ?? 0,
          currency,
          includes,
          excludes,
          main_image_url,
          status,
        ],
      );

      const experience = result.rows[0];

      // Log business event
      this.logger.logBusinessEvent('experience_created', {
        experienceId: experience.id,
        resortId: experience.resort_id,
        title: experience.title,
        category: experience.category,
        priceUSD: experience.price_cents / 100
      });

      return experience;
    } catch (error: unknown) {
      // Log error
      this.logger.logError(error as Error, {
        resortId: resort_id,
        title,
        category,
        action: 'create_experience'
      });

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

    const updatedExperience = result.rows[0];

    // Log business event
    this.logger.logBusinessEvent('experience_updated', {
      experienceId: id,
      resortId: updatedExperience.resort_id,
      title: updatedExperience.title,
      changes: updateExperienceDto,
      status: updatedExperience.status
    });

    return updatedExperience;
  }

  async remove(id: string): Promise<void> {
    // Get experience data before deletion for logging
    const experience = await this.findOne(id);

    const result = await this.db.query(
      'DELETE FROM experiences WHERE id = $1',
      [id],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Experience not found');
    }

    // Log business event
    this.logger.logBusinessEvent('experience_deleted', {
      experienceId: id,
      resortId: experience.resort_id,
      title: experience.title,
      status: experience.status
    });
  }

  async presignImageUpload(
    experienceId: string,
    presignDto: PresignImageDto,
  ): Promise<PresignedUrlResponse> {
    // Verify experience exists and get experience data
    const experience = await this.findOne(experienceId);

    // Validate file type
    if (!this.uploadService.validateFileType(presignDto.content_type)) {
      throw new BadRequestException('Invalid file type. Only images are allowed.');
    }

    // Get resort information for professional path structure
    const resortResult = await this.db.query(
      `SELECT name FROM resorts WHERE id = $1`,
      [experience.resort_id],
    );

    if (resortResult.rows.length === 0) {
      throw new NotFoundException('Resort not found');
    }

    const resortSlug = this.uploadService.generateSlug(resortResult.rows[0].name);
    const experienceSlug = this.uploadService.generateSlug(experience.title);

    // Count existing gallery images for proper indexing
    let galleryIndex = 1;
    if (presignDto.image_type === ExperienceImageType.GALLERY) {
      const countResult = await this.db.query(
        `SELECT COUNT(*) as count FROM experience_images 
         WHERE experience_id = $1 AND url LIKE '%/gallery/%'`,
        [experienceId],
      );
      galleryIndex = parseInt(countResult.rows[0].count) + 1;
    }

    // Generate professional blob path
    const blobPath = this.uploadService.generateExperienceBlobPath(
      resortSlug,
      experienceSlug,
      presignDto.image_type || 'gallery',
      presignDto.filename,
      galleryIndex,
    );

    // Generate presigned URL using Azure Blob Storage
    const options: PresignedUrlOptions = {
      containerName: 'livex-media',
      fileName: blobPath,
      contentType: presignDto.content_type,
      expiresInMinutes: 60,
    };

    const result = await this.uploadService.generatePresignedUrl(options);

    // Store the image record in database with the actual blob URL
    await this.db.query(
      `INSERT INTO experience_images (experience_id, url, sort_order, image_type) 
       VALUES ($1, $2, $3, $4)`,
      [experienceId, result.blobUrl, presignDto.sort_order || 0, presignDto.image_type || 'gallery'],
    );

    return {
      upload_url: result.uploadUrl,
      image_url: result.blobUrl,
      expires_in: result.expiresIn,
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

  async getReviews(experienceId: string): Promise<any[]> {
    // Verify experience exists
    await this.findOne(experienceId);

    const result = await this.db.query(
      `SELECT r.*, u.full_name as user_full_name, u.avatar as user_avatar
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.experience_id = $1
       ORDER BY r.created_at DESC`,
      [experienceId],
    );

    return result.rows;
  }

  async createReview(
    experienceId: string,
    userId: string,
    reviewDto: CreateReviewDto, // Typed as CreateReviewDto in controller
  ): Promise<Review> {
    // Verify experience exists
    await this.findOne(experienceId);

    // Check if user already reviewed this experience (optional, but good practice)
    const existing = await this.db.query(
      `SELECT id FROM reviews WHERE experience_id = $1 AND user_id = $2`,
      [experienceId, userId],
    );

    if (existing.rows.length > 0) {
      throw new BadRequestException('You have already reviewed this experience');
    }

    const { rating, comment, booking_id } = reviewDto;

    // Use explicit type for insert result
    const result = await this.db.query<Review>(
      `INSERT INTO reviews (experience_id, user_id, rating, comment, booking_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [experienceId, userId, rating, comment, booking_id],
    );

    const review = result.rows[0];

    // Fetch user info to return complete object matches getReviews
    const userResult = await this.db.query<{ full_name: string; avatar: string }>(
      `SELECT full_name, avatar FROM users WHERE id = $1`,
      [userId],
    );

    if (userResult.rows.length > 0) {
      review.user_full_name = userResult.rows[0].full_name;
      review.user_avatar = userResult.rows[0].avatar;
    }

    // Log business event
    this.logger.logBusinessEvent('review_created', {
      reviewId: review.id,
      experienceId: experienceId,
      userId: userId,
      rating: rating,
    });

    return review;
  }

  /**
   * Delete an experience image
   */
  async deleteExperienceImage(experienceId: string, imageId: string): Promise<void> {
    // Verify experience exists
    await this.findOne(experienceId);

    // Get image record
    const result = await this.db.query<ExperienceImage>(
      `SELECT * FROM experience_images WHERE id = $1 AND experience_id = $2`,
      [imageId, experienceId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Image not found');
    }

    const image = result.rows[0];

    // Extract blob name from URL and delete from Azure
    const blobName = this.uploadService.extractBlobNameFromUrl(image.url);
    if (blobName) {
      try {
        await this.uploadService.deleteFile('livex-media', blobName);
      } catch (error) {
        // Log error but don't fail the operation if blob doesn't exist
        console.warn(`Failed to delete blob ${blobName}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Remove from database
    await this.db.query(
      `DELETE FROM experience_images WHERE id = $1`,
      [imageId],
    );
  }

  /**
   * Upload experience image directly through API
   */
  async uploadExperienceImage(
    experienceId: string,
    file: any,
    sortOrder?: number,
    imageType?: string,
  ): Promise<{ image_url: string }> {
    // Verify experience exists and get experience data
    const experience = await this.findOne(experienceId);

    // Validate file
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    if (!this.uploadService.validateFileType(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only images are allowed.');
    }

    // Get resort information for professional path structure
    const resortResult = await this.db.query(
      `SELECT name FROM resorts WHERE id = $1`,
      [experience.resort_id],
    );

    if (resortResult.rows.length === 0) {
      throw new NotFoundException('Resort not found');
    }

    const resortSlug = this.uploadService.generateSlug(resortResult.rows[0].name);
    const experienceSlug = this.uploadService.generateSlug(experience.title);
    const finalImageType = (imageType === 'hero' ? 'hero' : 'gallery');

    // Count existing gallery images for proper indexing
    let galleryIndex = 1;
    if (finalImageType === 'gallery') {
      const countResult = await this.db.query(
        `SELECT COUNT(*) as count FROM experience_images 
         WHERE experience_id = $1 AND url LIKE '%/gallery/%'`,
        [experienceId],
      );
      galleryIndex = parseInt(countResult.rows[0].count) + 1;
    }

    // Generate professional blob path
    const blobPath = this.uploadService.generateExperienceBlobPath(
      resortSlug,
      experienceSlug,
      finalImageType,
      file.originalname || 'image',
      galleryIndex,
    );

    // Upload file directly to Azure
    const imageUrl = await this.uploadService.uploadFile(
      'livex-media',
      blobPath,
      file.buffer,
      file.mimetype,
    );

    // Store the image record in database
    await this.db.query(
      `INSERT INTO experience_images (experience_id, url, sort_order, image_type) 
       VALUES ($1, $2, $3, $4)`,
      [experienceId, imageUrl, sortOrder || 0, finalImageType],
    );

    return { image_url: imageUrl };
  }

  async submitForReview(id: string, userId: string, userRole: string): Promise<Experience> {
    // First check if experience exists and get current data
    const currentExperience = await this.findOne(id);

    // Check permissions - only resort owners or admins can submit
    if (userRole !== 'admin' && userRole !== 'resort') {
      throw new BadRequestException('Only resort owners or admins can submit experiences for review');
    }

    // Check current status
    if (currentExperience.status !== 'draft') {
      throw new BadRequestException('Only draft experiences can be submitted for review');
    }

    // Validate that experience has minimum required content
    if (!currentExperience.title || !currentExperience.description) {
      throw new BadRequestException('Experience must have title and description before submitting for review');
    }

    try {
      const result = await this.db.query(
        `UPDATE experiences 
         SET status = 'under_review', updated_at = NOW()
         WHERE id = $1 
         RETURNING *`,
        [id]
      );

      const experience = result.rows[0] as Experience;

      // Log the business event
      this.logger.logBusinessEvent('experience_submitted_for_review', {
        userId,
        experienceId: id,
        experienceTitle: experience.title,
        resortId: experience.resort_id
      });

      return experience;
    } catch (error: unknown) {
      // Log error
      this.logger.logError(error as Error, {
        userId,
        experienceId: id,
        action: 'submit_for_review'
      });

      throw error;
    }
  }
}
