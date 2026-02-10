import { Inject, Injectable } from '@nestjs/common';
import { DatabaseClient } from '../../../../database/database.client';
import { DATABASE_CLIENT } from '../../../../database/database.module';
import { PasswordResetToken } from '../../domain/entities/password-reset-token.entity';
import { TokenType, HashedToken } from '../../domain/value-objects/index';
import { IPasswordResetTokenRepository } from '../../domain/repositories/password-reset-token.repository.interface';

// Matches actual DB schema: id, user_id, token, created_at, expires_at, used_at
interface PasswordResetTokenRow {
    id: string;
    user_id: string;
    token: string;  // VARCHAR(6) - plain token, not hashed
    expires_at: Date;
    created_at: Date;
    used_at?: Date;
}

@Injectable()
export class PasswordResetTokenRepository implements IPasswordResetTokenRepository {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    ) { }

    async save(token: PasswordResetToken): Promise<void> {
        await this.db.query(
            `INSERT INTO password_reset_tokens (
                id, user_id, token, expires_at, created_at, used_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
                used_at = EXCLUDED.used_at`,
            [
                token.id, token.userId, token.hashedToken.value,
                token.expiresAt, token.createdAt, token.usedAt,
            ],
        );
    }

    async findById(id: string): Promise<PasswordResetToken | null> {
        const result = await this.db.query<PasswordResetTokenRow>(
            'SELECT * FROM password_reset_tokens WHERE id = $1',
            [id],
        );
        if (result.rows.length === 0) return null;
        return this.toDomain(result.rows[0]);
    }

    async findByHashedToken(hashedToken: string): Promise<PasswordResetToken | null> {
        const result = await this.db.query<PasswordResetTokenRow>(
            'SELECT * FROM password_reset_tokens WHERE token = $1',
            [hashedToken],
        );
        if (result.rows.length === 0) return null;
        return this.toDomain(result.rows[0]);
    }

    async findValidByUserId(userId: string): Promise<PasswordResetToken | null> {
        const result = await this.db.query<PasswordResetTokenRow>(
            `SELECT * FROM password_reset_tokens 
            WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1`,
            [userId],
        );
        if (result.rows.length === 0) return null;
        return this.toDomain(result.rows[0]);
    }

    async delete(id: string): Promise<void> {
        await this.db.query('DELETE FROM password_reset_tokens WHERE id = $1', [id]);
    }

    async deleteExpiredTokens(): Promise<number> {
        const result = await this.db.query<{ count: string }>(
            `WITH deleted AS (
                DELETE FROM password_reset_tokens 
                WHERE expires_at < NOW() OR used_at IS NOT NULL
                RETURNING *
            )
            SELECT COUNT(*) as count FROM deleted`,
        );
        return parseInt(result.rows[0]?.count ?? '0', 10);
    }

    private toDomain(row: PasswordResetTokenRow): PasswordResetToken {
        return PasswordResetToken.reconstitute(row.id, {
            userId: row.user_id,
            tokenType: TokenType.passwordReset(),
            hashedToken: HashedToken.create(row.token),
            isUsed: row.used_at !== null && row.used_at !== undefined,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
            usedAt: row.used_at,
        });
    }
}
