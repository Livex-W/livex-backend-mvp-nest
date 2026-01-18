import { Inject, Injectable } from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import type { PaginationDto } from '../common/dto/pagination.dto';
import type { PaginatedResult, PaginationMeta } from '../common/interfaces/pagination.interface';

export interface FavoriteExperienceDto {
    id: string;
    experience_id: string;
    experience: {
        id: string;
        title: string;
        slug: string;
        main_image_url: string | null;
        category: string;
        price_per_adult_cents: number;
        commission_per_adult_cents: number;
        currency: string;
        rating_avg: number;
        rating_count: number;
    };
    created_at: string;
}

@Injectable()
export class FavoritesService {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    ) { }

    async getUserFavorites(
        userId: string,
        paginationDto: PaginationDto,
    ): Promise<PaginatedResult<FavoriteExperienceDto>> {
        const { page = 1, limit = 20 } = paginationDto;
        const offset = (page - 1) * limit;

        // Count total
        const countResult = await this.db.query<{ count: string }>(
            'SELECT COUNT(*) as count FROM user_favorites WHERE user_id = $1',
            [userId],
        );
        const total = parseInt(countResult.rows[0]?.count || '0', 10);

        // Fetch favorites with experience details
        const query = `
      SELECT 
        f.id,
        f.experience_id,
        f.created_at,
        json_build_object(
          'id', e.id,
          'title', e.title,
          'slug', e.slug,
          'main_image_url', (
            SELECT ei.url FROM experience_images ei 
            WHERE ei.experience_id = e.id AND ei.image_type = 'hero' 
            ORDER BY ei.sort_order ASC LIMIT 1
          ),
          'category', e.category,
          'price_per_adult_cents', (
            SELECT s.price_per_adult_cents FROM availability_slots s 
            WHERE s.experience_id = e.id 
            ORDER BY s.price_per_adult_cents ASC LIMIT 1
          ),
          'commission_per_adult_cents', (
            SELECT s.commission_per_adult_cents FROM availability_slots s 
            WHERE s.experience_id = e.id 
            ORDER BY s.price_per_adult_cents ASC LIMIT 1
          ),
          'currency', e.currency,
          'rating_avg', e.rating_avg,
          'rating_count', e.rating_count
        ) as experience

      FROM user_favorites f
      JOIN experiences e ON e.id = f.experience_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `;

        const result = await this.db.query<FavoriteExperienceDto>(query, [userId, limit, offset]);

        const meta: PaginationMeta = {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page < Math.ceil(total / limit),
            hasPreviousPage: page > 1,
        };

        return { data: result.rows, meta };
    }

    async addFavorite(userId: string, experienceId: string): Promise<{ success: boolean }> {
        // Use INSERT ... ON CONFLICT DO NOTHING for idempotent insert
        await this.db.query(
            `INSERT INTO user_favorites (user_id, experience_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, experience_id) DO NOTHING`,
            [userId, experienceId],
        );
        return { success: true };
    }

    async removeFavorite(userId: string, experienceId: string): Promise<{ success: boolean }> {
        await this.db.query(
            'DELETE FROM user_favorites WHERE user_id = $1 AND experience_id = $2',
            [userId, experienceId],
        );
        return { success: true };
    }

    async isFavorite(userId: string, experienceId: string): Promise<{ is_favorite: boolean }> {
        const result = await this.db.query<{ exists: boolean }>(
            `SELECT EXISTS(
        SELECT 1 FROM user_favorites 
        WHERE user_id = $1 AND experience_id = $2
      ) as exists`,
            [userId, experienceId],
        );
        return { is_favorite: result.rows[0]?.exists ?? false };
    }

    async getUserFavoriteIds(userId: string): Promise<string[]> {
        const result = await this.db.query<{ experience_id: string }>(
            'SELECT experience_id FROM user_favorites WHERE user_id = $1',
            [userId],
        );
        return result.rows.map(row => row.experience_id);
    }
}
