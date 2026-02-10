import { Inject, Injectable } from '@nestjs/common';
import { DatabaseClient } from '../../../../database/database.client';
import { DATABASE_CLIENT } from '../../../../database/database.module';
import { UserPreference } from '../../domain/entities/user-preference.entity';
import { IUserPreferenceRepository } from '../../domain/repositories/user-preference.repository.interface';

interface UserPreferenceRow {
    user_id: string;
    language: string;
    currency: string;
    created_at: Date;
    updated_at: Date;
}

@Injectable()
export class UserPreferenceRepository implements IUserPreferenceRepository {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    ) { }

    async save(preference: UserPreference): Promise<void> {
        await this.db.query(
            `INSERT INTO user_preferences (user_id, language, currency, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                language = EXCLUDED.language,
                currency = EXCLUDED.currency,
                updated_at = EXCLUDED.updated_at`,
            [
                preference.userId,
                preference.language,
                preference.currency,
                preference.createdAt,
                preference.updatedAt,
            ],
        );
    }

    async findByUserId(userId: string): Promise<UserPreference | null> {
        const result = await this.db.query<UserPreferenceRow>(
            `SELECT user_id, language, currency, created_at, updated_at
            FROM user_preferences WHERE user_id = $1`,
            [userId],
        );

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return UserPreference.reconstitute(row.user_id, {
            userId: row.user_id,
            language: row.language,
            currency: row.currency,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }

    async delete(userId: string): Promise<void> {
        await this.db.query(
            'DELETE FROM user_preferences WHERE user_id = $1',
            [userId],
        );
    }
}
