import { Injectable, Logger, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { CreatePreferenceDto } from './dto/create-preference.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { UserPreference } from './entities/user-preference.entity';

@Injectable()
export class UserPreferencesService {
    private readonly logger = new Logger(UserPreferencesService.name);

    constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) { }

    async create(userId: string, dto: CreatePreferenceDto): Promise<UserPreference> {
        try {
            const language = dto.language || 'es';
            const currency = dto.currency || 'USD';

            const result = await this.db.query(
                `INSERT INTO user_preferences (user_id, language, currency, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING user_id, language, currency, created_at, updated_at`,
                [userId, language, currency]
            );

            this.logger.log(`Created preferences for user ${userId}`);

            return {
                userId: result.rows[0].user_id,
                language: result.rows[0].language,
                currency: result.rows[0].currency,
                createdAt: result.rows[0].created_at,
                updatedAt: result.rows[0].updated_at,
            };
        } catch (error: any) {
            if (error.code === '23505') { // Unique violation
                throw new ConflictException('User preferences already exist. Use PUT to update.');
            }
            this.logger.error(`Error creating preferences for user ${userId}`, error);
            throw error;
        }
    }

    async update(userId: string, dto: UpdatePreferenceDto): Promise<UserPreference> {
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (dto.language !== undefined) {
            updates.push(`language = $${paramIndex++}`);
            values.push(dto.language);
        }

        if (dto.currency !== undefined) {
            updates.push(`currency = $${paramIndex++}`);
            values.push(dto.currency);
        }

        if (updates.length === 0) {
            // No updates provided, just return current preferences
            return this.findByUserId(userId);
        }

        updates.push(`updated_at = NOW()`);
        values.push(userId);

        const result = await this.db.query(
            `UPDATE user_preferences 
       SET ${updates.join(', ')}
       WHERE user_id = $${paramIndex}
       RETURNING user_id, language, currency, created_at, updated_at`,
            values
        );

        if (result.rows.length === 0) {
            throw new NotFoundException('User preferences not found. Use POST to create.');
        }

        this.logger.log(`Updated preferences for user ${userId}`);

        return {
            userId: result.rows[0].user_id,
            language: result.rows[0].language,
            currency: result.rows[0].currency,
            createdAt: result.rows[0].created_at,
            updatedAt: result.rows[0].updated_at,
        };
    }

    async findByUserId(userId: string): Promise<UserPreference> {
        const result = await this.db.query(
            `SELECT user_id, language, currency, created_at, updated_at
       FROM user_preferences
       WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            throw new NotFoundException('User preferences not found');
        }

        return {
            userId: result.rows[0].user_id,
            language: result.rows[0].language,
            currency: result.rows[0].currency,
            createdAt: result.rows[0].created_at,
            updatedAt: result.rows[0].updated_at,
        };
    }

    async getOrCreateDefault(userId: string): Promise<UserPreference> {
        try {
            return await this.findByUserId(userId);
        } catch (error) {
            if (error instanceof NotFoundException) {
                // Return default preferences without creating them
                return {
                    userId,
                    language: 'es',
                    currency: 'USD',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
            }
            throw error;
        }
    }
}
