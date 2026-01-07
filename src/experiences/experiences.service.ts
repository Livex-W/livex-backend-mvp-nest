import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { PaginationService } from '../common/services/pagination.service';
import { CustomLoggerService } from '../common/services/logger.service';
import { PaginatedResult, PaginationOptions } from '../common/interfaces/pagination.interface';
import { Experience, ExperienceWithImages, ExperienceImage, ExperienceLocation } from './entities/experience.entity';
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
import { UserPreferencesService } from '../user-preferences/user-preferences.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { convertPrice } from '../common/utils/price-converter';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';


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
    private readonly userPreferencesService: UserPreferencesService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) { }

  async create(createExperienceDto: CreateExperienceDto, user?: JwtPayload): Promise<Experience> {
    // Enforce resort ownership for 'resort' role
    if (user && user.role === 'resort') {
      const resortResult = await this.db.query<{ id: string }>(
        'SELECT id FROM resorts WHERE owner_user_id = $1',
        [user.sub],
      );

      if (resortResult.rows.length === 0) {
        throw new BadRequestException('You do not have a resort created yet. Please create a resort first.');
      }
      // Override resort_id with the one owned by the user
      createExperienceDto.resort_id = resortResult.rows[0].id;
    }

    const {
      resort_id,
      title,
      description,
      category,
      price_per_adult_cents,
      price_per_child_cents,
      commission_per_adult_cents,
      commission_per_child_cents,
      allows_children,
      child_min_age,
      child_max_age,
      currency,
      includes,
      excludes,
      status,
    } = createExperienceDto;

    try {
      const result = await this.db.query<Experience>(
        `INSERT INTO experiences (
          resort_id, title, description, category,
          price_per_adult_cents, price_per_child_cents,
          commission_per_adult_cents, commission_per_child_cents,
          allows_children, child_min_age, child_max_age,
          currency, includes, excludes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
        RETURNING *`,
        [
          resort_id,
          title,
          description,
          category,
          price_per_adult_cents,
          price_per_child_cents ?? 0,
          commission_per_adult_cents ?? 0,
          commission_per_child_cents ?? 0,
          allows_children ?? true,
          child_min_age,
          child_max_age,
          currency,
          includes,
          excludes,
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
        pricePerAdultUSD: experience.price_per_adult_cents / 100
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

      if (isPostgreSQLError(error) && error.code === '23505') {
        // Unique constraint violation - duplicate slug
        if (error.constraint === 'uq_experiences_resort_slug') {
          throw new BadRequestException(
            'Ya existe una experiencia con este nombre. Por favor elige un título diferente.'
          );
        }
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

    // Build WHERE conditions - always filter by is_active
    const conditions: string[] = ['e.is_active = true'];
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
      conditions.push(`e.price_per_adult_cents >= $${paramIndex}`);
      params.push(queryDto.min_price);
      paramIndex++;
    }

    if (queryDto.max_price !== undefined) {
      conditions.push(`e.price_per_adult_cents <= $${paramIndex}`);
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
      ['title', 'category', 'price_per_adult_cents', 'rating_avg', 'rating_count', 'created_at', 'updated_at'],
    );
    const orderByClause = this.paginationService.buildOrderByClause(
      sortOptions,
      'e.created_at DESC',
    );

    // Build base query - get main_image_url from experience_images where image_type = 'hero'
    const baseQuery = `
      SELECT e.*,
        (SELECT ei.url FROM experience_images ei 
         WHERE ei.experience_id = e.id AND ei.image_type = 'hero'
         ORDER BY ei.sort_order ASC, ei.created_at ASC 
         LIMIT 1) as main_image_url
      FROM experiences e 
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

    // Always include locations (needed for proximity filtering)
    // and optionally include images
    if (result.data.length > 0) {
      const experienceIds = result.data.map(exp => exp.id);

      // Always fetch locations for proximity filtering
      const locations = await this.getExperienceLocations(experienceIds);

      // Fetch slot info (duration and capacity)
      const slotInfo = await this.getSlotInfo(experienceIds);

      // Optionally fetch images
      const images = queryDto.include_images
        ? await this.getExperienceImages(experienceIds)
        : [];

      const experiencesWithData: ExperienceWithImages[] = result.data.map(experience => {
        const info = slotInfo.get(experience.id);
        return {
          ...experience,
          locations: locations.filter(loc => loc.experience_id === experience.id),
          images: queryDto.include_images
            ? images.filter(img => img.experience_id === experience.id)
            : undefined,
          duration_minutes: info?.duration_minutes,
          max_capacity: info?.max_capacity,
        };
      });

      return {
        ...result,
        data: experiencesWithData,
      };
    }

    return result as PaginatedResult<ExperienceWithImages>;
  }

  async findOne(id: string, includeImages = false): Promise<ExperienceWithImages> {
    const result = await this.db.query<Experience>(
      'SELECT * FROM experiences WHERE id = $1 AND is_active = true',
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Experience not found');
    }

    const experience = result.rows[0];

    // Always fetch locations for consistency
    const locations = await this.getExperienceLocations([id]);

    // Fetch slot info
    const slotInfo = await this.getSlotInfo([id]);
    const info = slotInfo.get(id);

    // Optionally fetch images
    const images = includeImages ? await this.getExperienceImages([id]) : undefined;

    return {
      ...experience,
      locations,
      images,
      duration_minutes: info?.duration_minutes,
      max_capacity: info?.max_capacity,
    };
  }

  async findBySlug(resortId: string, slug: string, includeImages = false): Promise<ExperienceWithImages> {
    const result = await this.db.query<Experience>(
      'SELECT * FROM experiences WHERE resort_id = $1 AND slug = $2 AND is_active = true',
      [resortId, slug],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Experience not found');
    }

    const experience = result.rows[0];

    // Always fetch locations for consistency
    const locations = await this.getExperienceLocations([experience.id]);

    // Fetch slot info
    const slotInfo = await this.getSlotInfo([experience.id]);
    const info = slotInfo.get(experience.id);

    // Optionally fetch images
    const images = includeImages ? await this.getExperienceImages([experience.id]) : undefined;

    return {
      ...experience,
      locations,
      images,
      duration_minutes: info?.duration_minutes,
      max_capacity: info?.max_capacity,
    };
  }

  /**
   * Find all experiences with display prices converted to user's currency
   */
  async findAllWithPrices(
    queryDto: QueryExperiencesDto,
    userId?: string,
  ): Promise<PaginatedResult<ExperienceWithImages>> {
    const result = await this.findAll(queryDto);

    if (userId && result.data.length > 0) {
      const convertedData = await this.addDisplayPrices(result.data, userId) as ExperienceWithImages[];
      return {
        ...result,
        data: convertedData,
      };
    }

    return result;
  }

  /**
   * Get top recommended experiences (highest rated)
   * Returns top 5 experiences ordered by rating_avg DESC
   */
  async findRecommended(limit = 5, userId?: string): Promise<ExperienceWithImages[]> {
    const result = await this.db.query<Experience>(
      `SELECT * FROM experiences 
       WHERE status = 'active' AND is_active = true
       ORDER BY rating_avg DESC, rating_count DESC 
       LIMIT $1`,
      [limit],
    );

    if (result.rows.length === 0) {
      return [];
    }

    const experienceIds = result.rows.map(exp => exp.id);

    // Fetch locations, images, and slot info
    const locations = await this.getExperienceLocations(experienceIds);
    const images = await this.getExperienceImages(experienceIds);
    const slotInfo = await this.getSlotInfo(experienceIds);

    let experiencesWithData: ExperienceWithImages[] = result.rows.map(experience => {
      const info = slotInfo.get(experience.id);
      return {
        ...experience,
        locations: locations.filter(loc => loc.experience_id === experience.id),
        images: images.filter(img => img.experience_id === experience.id),
        duration_minutes: info?.duration_minutes,
        max_capacity: info?.max_capacity,
      };
    });

    // Add display prices if user ID is provided
    if (userId) {
      experiencesWithData = await this.addDisplayPrices(experiencesWithData, userId) as ExperienceWithImages[];
    }

    return experiencesWithData;
  }

  /**
   * Find experiences managed by the current user (Resort Owner or Agent)
   */
  async findManaged(
    queryDto: QueryExperiencesDto,
    user: JwtPayload,
  ): Promise<PaginatedResult<ExperienceWithImages>> {
    let resortId: string | undefined;

    if (user.role === 'resort') {
      // Find resort owned by user
      const resortResult = await this.db.query<{ id: string }>(
        'SELECT id FROM resorts WHERE owner_user_id = $1',
        [user.sub],
      );

      if (resortResult.rows.length === 0) {
        // Return empty result if no resort associated
        return {
          data: [],
          meta: {
            total: 0,
            page: queryDto.page ?? 1,
            limit: queryDto.limit ?? 10,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        };
      }
      resortId = resortResult.rows[0].id;
    } else if (user.role === 'agent') {
      // Find resort associated with agent
      const agentResult = await this.db.query<{ resort_id: string }>(
        'SELECT resort_id FROM resort_agents WHERE user_id = $1 AND is_active = true',
        [user.sub],
      );

      if (agentResult.rows.length === 0 || !agentResult.rows[0].resort_id) {
        // Return empty result if no resort associated
        return {
          data: [],
          meta: {
            total: 0,
            page: queryDto.page ?? 1,
            limit: queryDto.limit ?? 10,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        };
      }
      resortId = agentResult.rows[0].resort_id;
    } else if (user.role === 'admin') {
      // Admin sees all, or filters by provided resort_id in query
      // No forced resortId override needed
    } else {
      // Tourists or other roles shouldn't access management endpoint really, 
      // but if they do, they see nothing or existing logic handles it.
      // Let's safe guard:
      return {
        data: [],
        meta: {
          total: 0,
          page: queryDto.page ?? 1,
          limit: queryDto.limit ?? 10,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        }
      };
    }

    // Force the resort_id filter if resolved
    if (resortId) {
      queryDto.resort_id = resortId;
    }

    // Call standard findAll with the enforced filter
    return this.findAllWithPrices(queryDto, user.sub);
  }

  /**
   * Find one experience with display prices converted to user's currency
   */
  async findOneWithPrices(
    id: string,
    includeImages = false,
    userId?: string,
  ): Promise<ExperienceWithImages> {
    const experience = await this.findOne(id, includeImages);

    if (userId) {
      return await this.addDisplayPrices(experience, userId) as ExperienceWithImages;
    }

    return experience;
  }

  /**
   * Find experience by slug with display prices converted to user's currency
   */
  async findBySlugWithPrices(
    resortId: string,
    slug: string,
    includeImages = false,
    userId?: string,
  ): Promise<ExperienceWithImages> {
    const experience = await this.findBySlug(resortId, slug, includeImages);

    if (userId) {
      return await this.addDisplayPrices(experience, userId) as ExperienceWithImages;
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
    // Get experience data before soft deletion for logging
    const experience = await this.findOne(id);

    // Soft delete: set is_active to false
    const result = await this.db.query(
      'UPDATE experiences SET is_active = false WHERE id = $1 AND is_active = true',
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
      status: experience.status,
      softDelete: true
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

    // Generate presigned URL using AWS S3
    const options: PresignedUrlOptions = {
      containerName: '',
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

  private async getExperienceLocations(experienceIds: string[]): Promise<ExperienceLocation[]> {
    if (experienceIds.length === 0) return [];

    const placeholders = experienceIds.map((_, index) => `$${index + 1}`).join(', ');

    const result = await this.db.query<ExperienceLocation>(
      `SELECT * FROM experience_locations 
       WHERE experience_id IN (${placeholders}) 
       ORDER BY experience_id, created_at ASC`,
      experienceIds,
    );

    return result.rows;
  }

  /**
   * Get slot info (duration and capacity) for experiences
   * Returns the typical duration (mode) and max capacity from availability_slots
   */
  private async getSlotInfo(experienceIds: string[]): Promise<Map<string, { duration_minutes: number; max_capacity: number }>> {
    if (experienceIds.length === 0) return new Map();

    const placeholders = experienceIds.map((_, index) => `$${index + 1}`).join(', ');

    // Get the most common duration and max capacity for each experience
    const result = await this.db.query<{
      experience_id: string;
      duration_minutes: number;
      max_capacity: number;
    }>(
      `SELECT 
        experience_id,
        EXTRACT(EPOCH FROM (end_time - start_time))::integer / 60 AS duration_minutes,
        MAX(capacity) AS max_capacity
       FROM availability_slots
       WHERE experience_id IN (${placeholders})
       GROUP BY experience_id, EXTRACT(EPOCH FROM (end_time - start_time))::integer / 60
       ORDER BY experience_id, COUNT(*) DESC`,
      experienceIds,
    );

    // Build map with first (most common) duration per experience
    const slotInfoMap = new Map<string, { duration_minutes: number; max_capacity: number }>();
    for (const row of result.rows) {
      if (!slotInfoMap.has(row.experience_id)) {
        slotInfoMap.set(row.experience_id, {
          duration_minutes: row.duration_minutes,
          max_capacity: row.max_capacity,
        });
      }
    }

    return slotInfoMap;
  }



  /**
 * Add display prices to experience(s) based on user preferences
 */
  private async addDisplayPrices<T extends Experience>(
    experiences: T | T[],
    userId?: string,
  ): Promise<T | T[]> {
    if (!userId) {
      return experiences;
    }

    try {
      const preferences = await this.userPreferencesService.getOrCreateDefault(userId);

      // Helper to convert a single experience
      const convertExperience = async (exp: T): Promise<T> => {
        // Case 1: Experience currency matches user preference - no conversion needed
        if (exp.currency === preferences.currency) {
          return {
            ...exp,
            display_price_per_adult: exp.price_per_adult_cents,
            display_price_per_child: exp.price_per_child_cents,
            display_commission_per_adult: exp.commission_per_adult_cents ?? 0,
            display_commission_per_child: exp.commission_per_child_cents ?? 0,
            display_currency: exp.currency,
          };
        }

        // Case 2: Get exchange rates for both currencies
        const sourceRate = await this.exchangeRatesService.getRate(exp.currency);
        const targetRate = await this.exchangeRatesService.getRate(preferences.currency);

        if (!sourceRate || !targetRate) {
          this.logger.log('Cannot convert - missing exchange rates', {
            experienceCurrency: exp.currency,
            userCurrency: preferences.currency,
            experienceId: exp.id,
            sourceRate,
            targetRate,
          });
          return exp; // Return without display prices
        }

        // Case 3: Convert between any two currencies
        const displayPricePerAdult = convertPrice({
          sourceCurrency: exp.currency,
          targetCurrency: preferences.currency,
          priceCents: exp.price_per_adult_cents,
          sourceRate: sourceRate,
          targetRate: targetRate,
        });

        const displayPricePerChild = convertPrice({
          sourceCurrency: exp.currency,
          targetCurrency: preferences.currency,
          priceCents: exp.price_per_child_cents,
          sourceRate: sourceRate,
          targetRate: targetRate,
        });

        const displayCommissionPerAdult = convertPrice({
          sourceCurrency: exp.currency,
          targetCurrency: preferences.currency,
          priceCents: exp.commission_per_adult_cents ?? 0,
          sourceRate: sourceRate,
          targetRate: targetRate,
        });

        const displayCommissionPerChild = convertPrice({
          sourceCurrency: exp.currency,
          targetCurrency: preferences.currency,
          priceCents: exp.commission_per_child_cents ?? 0,
          sourceRate: sourceRate,
          targetRate: targetRate,
        });

        this.logger.log('Price conversion applied', {
          experienceId: exp.id,
          from: exp.currency,
          to: preferences.currency,
          originalAdultPrice: exp.price_per_adult_cents,
          displayAdultPrice: displayPricePerAdult,
        });

        return {
          ...exp,
          display_price_per_adult: displayPricePerAdult,
          display_price_per_child: displayPricePerChild,
          display_commission_per_adult: displayCommissionPerAdult,
          display_commission_per_child: displayCommissionPerChild,
          display_currency: preferences.currency,
        };
      };

      if (Array.isArray(experiences)) {
        return Promise.all(experiences.map(convertExperience));
      }

      return convertExperience(experiences);
    } catch (error) {
      this.logger.logError(error as Error, {
        action: 'add_display_prices',
        userId,
      });
      return experiences;
    }
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

    // Extract blob name from URL and delete from S3
    const blobName = this.uploadService.extractBlobNameFromUrl(image.url);
    if (blobName) {
      try {
        await this.uploadService.deleteFile('', blobName);
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
    // Valid image types
    const finalImageType = (imageType === 'hero' || imageType === 'main' ? 'hero' : 'gallery');

    // Count existing gallery images for proper indexing
    let galleryIndex = 1;
    if (finalImageType === 'gallery') {
      const countResult = await this.db.query(
        `SELECT COUNT(*) as count FROM experience_images 
         WHERE experience_id = $1 AND url LIKE '%/gallery/%'`,
        [experienceId],
      );
      galleryIndex = parseInt(countResult.rows[0].count as string) + 1;
    }

    // Generate professional blob path
    const blobPath = this.uploadService.generateExperienceBlobPath(
      resortSlug,
      experienceSlug,
      finalImageType,
      file.originalname || 'image',
      galleryIndex,
    );

    // Upload file directly to S3
    const imageUrl = await this.uploadService.uploadFile(
      '',
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
