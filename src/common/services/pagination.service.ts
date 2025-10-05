import { Injectable, Inject } from '@nestjs/common';
import { DatabaseClient } from '../../database/database.client';
import { DATABASE_CLIENT } from '../../database/database.module';
import { 
  PaginatedResult, 
  PaginationMeta, 
  PaginationOptions, 
  SortOption 
} from '../interfaces/pagination.interface';
import { QueryResultRow } from 'pg';

@Injectable()
export class PaginationService {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  /**
   * Creates pagination metadata
   */
  createMeta(options: PaginationOptions, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / options.limit);
    
    return {
      page: options.page,
      limit: options.limit,
      total,
      totalPages,
      hasNextPage: options.page < totalPages,
      hasPreviousPage: options.page > 1,
    };
  }

  /**
   * Creates a paginated result
   */
  createPaginatedResult<T>(
    data: T[],
    options: PaginationOptions,
    total: number,
  ): PaginatedResult<T> {
    return {
      data,
      meta: this.createMeta(options, total),
    };
  }

  /**
   * Parses sort options from string array
   */
  parseSortOptions(sort?: string[], allowedFields: string[] = []): SortOption[] {
    if (!sort || sort.length === 0) {
      return [];
    }

    return sort
      .map(sortItem => {
        const [field, direction = 'ASC'] = sortItem.split(':');
        const normalizedDirection = direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        
        // Only allow sorting by specified fields to prevent SQL injection
        if (allowedFields.length > 0 && !allowedFields.includes(field)) {
          return null;
        }

        return {
          field,
          direction: normalizedDirection,
        };
      })
      .filter(Boolean) as SortOption[];
  }

  /**
   * Builds ORDER BY clause from sort options
   */
  buildOrderByClause(sortOptions: SortOption[], defaultSort = 'created_at DESC'): string {
    if (sortOptions.length === 0) {
      return `ORDER BY ${defaultSort}`;
    }

    const orderClauses = sortOptions.map(sort => `${sort.field} ${sort.direction}`);
    return `ORDER BY ${orderClauses.join(', ')}`;
  }

  /**
   * Builds search WHERE clause for text fields
   */
  buildSearchClause(
    search: string | undefined,
    searchFields: string[],
    paramIndex = 1,
  ): { clause: string; params: any[]; nextParamIndex: number } {
    if (!search || search.trim() === '' || searchFields.length === 0) {
      return { clause: '', params: [], nextParamIndex: paramIndex };
    }

    const searchTerm = `%${search.trim()}%`;
    const conditions = searchFields.map(field => `${field} ILIKE $${paramIndex}`);
    const clause = `AND (${conditions.join(' OR ')})`;
    
    return {
      clause,
      params: [searchTerm],
      nextParamIndex: paramIndex + 1,
    };
  }

  /**
   * Executes a paginated query
   */
  async executePaginatedQuery<T extends QueryResultRow>(
    baseQuery: string,
    countQuery: string,
    params: any[],
    options: PaginationOptions,
  ): Promise<PaginatedResult<T>> {
    // Execute count query
    const countResult = await this.db.query<{ count: string }>(countQuery, params);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Execute data query with pagination
    const dataQuery = `${baseQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const dataParams = [...params, options.limit, options.offset];
    const dataResult = await this.db.query<T>(dataQuery, dataParams);

    return this.createPaginatedResult(dataResult.rows, options, total);
  }
}
