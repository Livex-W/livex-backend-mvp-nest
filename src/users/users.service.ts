import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import type { UserRole } from '../common/constants/roles';
import { UserEntity, SafeUser } from './entities/user.entity';

interface UserRow extends QueryResultRow {
    id: string;
    email: string;
    password_hash: string;
    full_name: string | null;
    role: string;
    created_at: Date;
    updated_at: Date;
}

@Injectable()
export class UsersService {
    constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) { }

    async findByEmail(email: string): Promise<UserEntity | null> {
        const result = await this.db.query<UserRow>(
            `SELECT id, email, password_hash, full_name, role, created_at, updated_at
            FROM users WHERE email = $1`,
            [email],
        );

        if (result.rowCount === 0) {
            return null;
        }

        return this.mapRowToEntity(result.rows[0]);
    }

    async findById(id: string): Promise<UserEntity | null> {
        const result = await this.db.query<UserRow>(
            `SELECT id, email, password_hash, full_name, role, created_at, updated_at
            FROM users WHERE id = $1`,
            [id],
        );

        if (result.rowCount === 0) {
            return null;
        }

        return this.mapRowToEntity(result.rows[0]);
    }

    async createUser(params: {
        email: string;
        passwordHash: string;
        fullName?: string | null;
        role: UserRole;
    }): Promise<UserEntity> {
        const result = await this.db.query<UserRow>(
            `INSERT INTO users (email, password_hash, full_name, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, email, password_hash, full_name, role, created_at, updated_at`,
            [params.email, params.passwordHash, params.fullName ?? null, params.role],
        );

        return this.mapRowToEntity(result.rows[0]);
    }

    async updateProfile(
        userId: string,
        params: {
            fullName?: string | null;
            email?: string;
        },
    ): Promise<UserEntity> {
        const updates: string[] = [];
        const values: unknown[] = [];
        let placeholderIndex = 1;

        if (params.fullName !== undefined) {
            updates.push(`full_name = $${placeholderIndex++}`);
            values.push(params.fullName);
        }

        if (params.email !== undefined) {
            await this.assertEmailAvailable(params.email, userId);
            updates.push(`email = $${placeholderIndex++}`);
            values.push(params.email);
        }

        if (updates.length === 0) {
            const existingUser = await this.findById(userId);
            if (!existingUser) {
                throw new NotFoundException('User not found');
            }
            return existingUser;
        }

        updates.push(`updated_at = now()`);
        values.push(userId);

        const result = await this.db.query<UserRow>(
            `UPDATE users
            SET ${updates.join(', ')}
            WHERE id = $${placeholderIndex}
            RETURNING id, email, password_hash, full_name, role, created_at, updated_at`,
            values,
        );

        if (result.rowCount === 0) {
            throw new NotFoundException('User not found');
        }

        return this.mapRowToEntity(result.rows[0]);
    }

    private async assertEmailAvailable(email: string, ownerId?: string): Promise<void> {
        const existing = await this.findByEmail(email);

        if (existing && existing.id !== ownerId) {
            throw new ConflictException('Email already registered');
        }
    }

    async updatePassword(userId: string, passwordHash: string): Promise<void> {
        const result = await this.db.query(
            `UPDATE users
            SET password_hash = $2,
                updated_at = now()
            WHERE id = $1`,
            [userId, passwordHash],
        );

        if (result.rowCount === 0) {
            throw new NotFoundException('User not found');
        }
    }

    toSafeUser(user: UserEntity): SafeUser {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, ...safeUser } = user;
        return safeUser;
    }

    private mapRowToEntity(row: UserRow): UserEntity {
        return {
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            fullName: row.full_name,
            role: row.role as UserEntity['role'],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
