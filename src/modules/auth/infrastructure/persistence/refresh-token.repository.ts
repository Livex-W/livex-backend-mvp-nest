import { Inject, Injectable } from '@nestjs/common';
import { DatabaseClient } from '../../../../database/database.client';
import { DATABASE_CLIENT } from '../../../../database/database.module';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { TokenType, HashedToken } from '../../domain/value-objects/index';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';

interface RefreshTokenRow {
    id: string;
    user_id: string;
    jti: string;
    user_agent?: string;
    ip?: string;
    revoked_at?: Date;
    expires_at: Date;
    created_at: Date;
    last_used_at?: Date;
}

@Injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    ) { }

    async save(token: RefreshToken): Promise<void> {
        // Map domain fields to DB columns:
        // id -> id (and jti)
        // deviceInfo -> user_agent
        // ipAddress -> ip
        // isRevoked -> revoked_at (set to now if true, null if false)
        // hashedToken -> IGNORED (DB does not store hash)

        const revokedAt = token.isRevoked ? new Date() : null;

        await this.db.query(
            `INSERT INTO refresh_tokens (
                id, user_id, jti, user_agent, ip,
                revoked_at, expires_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET
                revoked_at = EXCLUDED.revoked_at`,
            [
                token.id,              // id
                token.userId,          // user_id
                token.id,              // jti (we use the entity ID as JTI)
                token.deviceInfo,      // user_agent
                token.ipAddress,       // ip
                revokedAt,             // revoked_at
                token.expiresAt,       // expires_at
                token.createdAt,       // created_at
            ],
        );
    }

    async findById(id: string): Promise<RefreshToken | null> {
        const result = await this.db.query<RefreshTokenRow>(
            'SELECT * FROM refresh_tokens WHERE id = $1',
            [id],
        );
        if (result.rows.length === 0) return null;
        return this.toDomain(result.rows[0]);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async findByHashedToken(_hashedToken: string): Promise<RefreshToken | null> {
        // Cannot search by hash since DB doesn't store it.
        // This method should be deprecated or modified in usage.
        return await Promise.resolve(null);
    }

    async findByUserId(userId: string): Promise<RefreshToken[]> {
        const result = await this.db.query<RefreshTokenRow>(
            'SELECT * FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at DESC',
            [userId],
        );
        return result.rows.map(row => this.toDomain(row));
    }

    async findValidByUserId(userId: string): Promise<RefreshToken[]> {
        const result = await this.db.query<RefreshTokenRow>(
            `SELECT * FROM refresh_tokens 
            WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
            ORDER BY created_at DESC`,
            [userId],
        );
        return result.rows.map(row => this.toDomain(row));
    }

    async delete(id: string): Promise<void> {
        await this.db.query('DELETE FROM refresh_tokens WHERE id = $1', [id]);
    }

    async deleteByUserId(userId: string): Promise<void> {
        await this.db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    }

    async revokeAllForUser(userId: string): Promise<void> {
        await this.db.query(
            'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1',
            [userId],
        );
    }

    private toDomain(row: RefreshTokenRow): RefreshToken {
        return RefreshToken.reconstitute(row.id, {
            userId: row.user_id,
            tokenType: TokenType.refresh(),
            // We don't have the hash, so we use a placeholder.
            // Verification relies on JTI (id) existence, not hash comparison in this DB schema.
            hashedToken: HashedToken.create('STORED_AS_JTI_NO_HASH'),
            deviceInfo: row.user_agent,
            ipAddress: row.ip,
            isRevoked: !!row.revoked_at,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
            lastUsedAt: row.last_used_at,
        });
    }
}
