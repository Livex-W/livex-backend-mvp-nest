import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { PaginationService } from '../common/services/pagination.service';
import { CustomLoggerService } from '../common/services/logger.service';
import { PaginatedResult, PaginationOptions } from '../common/interfaces/pagination.interface';
import { Category } from './entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto, QueryCategoriesDto } from './dto';

interface PostgreSQLError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
}

function isPostgreSQLError(error: unknown): error is PostgreSQLError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string'
  );
}

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly paginationService: PaginationService,
    private readonly logger: CustomLoggerService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const { name, slug } = createCategoryDto;

    // Generate slug from name if not provided
    const finalSlug = slug || this.generateSlug(name);

    try {
      const result = await this.db.query<Category>(
        `INSERT INTO categories (name, slug)
          VALUES ($1, $2)
          RETURNING *`,
        [name, finalSlug],
      );

      const category = result.rows[0];

      // Log business event
      this.logger.logBusinessEvent('category_created', {
        categoryId: category.id,
        name: category.name,
        slug: category.slug
      });

      return category;
    } catch (error: unknown) {
      // Log error
      this.logger.logError(error as Error, {
        name,
        slug: finalSlug,
        action: 'create_category'
      });

      if (isPostgreSQLError(error) && error.code === '23505') {
        // Unique constraint violation
        throw new ConflictException('Category with this slug already exists');
      }
      throw error;
    }
  }

  async findAll(queryDto: QueryCategoriesDto): Promise<PaginatedResult<Category>> {
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
        ['name', 'slug'],
        paramIndex,
      );
      if (searchClause.clause) {
        conditions.push(searchClause.clause.replace('AND ', ''));
         
        params.push(...searchClause.params);
        paramIndex = searchClause.nextParamIndex;
      }
    }

    // Specific filters
    if (queryDto.name) {
      conditions.push(`name ILIKE $${paramIndex}`);
      params.push(`%${queryDto.name}%`);
      paramIndex++;
    }

    if (queryDto.slug) {
      conditions.push(`slug = $${paramIndex}`);
      params.push(queryDto.slug);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build sort options
    const sortOptions = this.paginationService.parseSortOptions(
      queryDto.sort,
      ['name', 'slug', 'created_at'],
    );
    const orderByClause = this.paginationService.buildOrderByClause(
      sortOptions,
      'created_at DESC',
    );

    // Build queries
    const baseQuery = `
      SELECT * FROM categories 
      ${whereClause} 
      ${orderByClause}
    `;

    const countQuery = `
      SELECT COUNT(*) as count FROM categories 
      ${whereClause}
    `;

    return this.paginationService.executePaginatedQuery<Category>(
      baseQuery,
      countQuery,
      params,
      options,
    );
  }

  async findOne(id: string): Promise<Category> {
    const result = await this.db.query<Category>(
      'SELECT * FROM categories WHERE id = $1',
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Category not found');
    }

    return result.rows[0];
  }

  async findBySlug(slug: string): Promise<Category> {
    const result = await this.db.query<Category>(
      'SELECT * FROM categories WHERE slug = $1',
      [slug],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Category not found');
    }

    return result.rows[0];
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    const { name, slug } = updateCategoryDto;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }

    if (slug !== undefined) {
      updates.push(`slug = $${paramIndex}`);
      params.push(slug);
      paramIndex++;
    }

    if (updates.length === 0) {
      return category;
    }

    params.push(id);

    try {
      const result = await this.db.query<Category>(
        `UPDATE categories
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *`,
        params,
      );

      const updatedCategory = result.rows[0];

      // Log business event
      this.logger.logBusinessEvent('category_updated', {
        categoryId: id,
        name: updatedCategory.name,
        slug: updatedCategory.slug,
        changes: updateCategoryDto
      });

      return updatedCategory;
    } catch (error: unknown) {
      // Log error
      this.logger.logError(error as Error, {
        categoryId: id,
        changes: updateCategoryDto,
        action: 'update_category'
      });

      if (isPostgreSQLError(error) && error.code === '23505') {
        // Unique constraint violation
        throw new ConflictException('Category with this slug already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    // Get category data before deletion for logging
    const category = await this.findOne(id);

    const result = await this.db.query(
      'DELETE FROM categories WHERE id = $1',
      [id],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Category not found');
    }

    // Log business event
    this.logger.logBusinessEvent('category_deleted', {
      categoryId: id,
      name: category.name,
      slug: category.slug
    });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }
}
