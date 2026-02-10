import { Inject, Injectable } from '@nestjs/common';
import { DatabaseClient } from '../../../../database/database.client';
import { DATABASE_CLIENT } from '../../../../database/database.module';
import { Favorite } from '../../domain/entities/favorite.entity';
import { IFavoriteRepository } from '../../domain/repositories/favorite.repository.interface';

interface FavoriteRow {
    id: string;
    user_id: string;
    experience_id: string;
    created_at: Date;
}

@Injectable()
export class FavoriteRepository implements IFavoriteRepository {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    ) { }

    async save(favorite: Favorite): Promise<void> {
        await this.db.query(
            `INSERT INTO user_favorites (id, user_id, experience_id, created_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, experience_id) DO NOTHING`,
            [favorite.id, favorite.userId, favorite.experienceId, favorite.createdAt],
        );
    }

    async findByUserId(userId: string): Promise<Favorite[]> {
        const result = await this.db.query<FavoriteRow>(
            'SELECT * FROM user_favorites WHERE user_id = $1 ORDER BY created_at DESC',
            [userId],
        );
        return result.rows.map(row => Favorite.reconstitute(row.id, {
            userId: row.user_id,
            experienceId: row.experience_id,
            createdAt: row.created_at,
        }));
    }

    async findByUserAndExperience(userId: string, experienceId: string): Promise<Favorite | null> {
        const result = await this.db.query<FavoriteRow>(
            'SELECT * FROM user_favorites WHERE user_id = $1 AND experience_id = $2',
            [userId, experienceId],
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return Favorite.reconstitute(row.id, {
            userId: row.user_id,
            experienceId: row.experience_id,
            createdAt: row.created_at,
        });
    }

    async delete(id: string): Promise<void> {
        await this.db.query('DELETE FROM user_favorites WHERE id = $1', [id]);
    }

    async deleteByUserAndExperience(userId: string, experienceId: string): Promise<void> {
        await this.db.query(
            'DELETE FROM user_favorites WHERE user_id = $1 AND experience_id = $2',
            [userId, experienceId],
        );
    }

    async exists(userId: string, experienceId: string): Promise<boolean> {
        const result = await this.db.query<{ exists: boolean }>(
            `SELECT EXISTS(
                SELECT 1 FROM user_favorites 
                WHERE user_id = $1 AND experience_id = $2
            ) as exists`,
            [userId, experienceId],
        );
        return result.rows[0]?.exists ?? false;
    }

    async countByUserId(userId: string): Promise<number> {
        const result = await this.db.query<{ count: string }>(
            'SELECT COUNT(*) as count FROM user_favorites WHERE user_id = $1',
            [userId],
        );
        return parseInt(result.rows[0]?.count ?? '0', 10);
    }
}
