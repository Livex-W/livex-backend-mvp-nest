import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { CustomLoggerService } from '../common/services/logger.service';
import type { UserRole } from '../common/constants/roles';
import { UserEntity, SafeUser } from './entities/user.entity';

interface UserRow extends QueryResultRow {
    id: string;
    email: string;
    password_hash: string | null;
    firebase_uid: string | null;
    full_name: string | null;
    phone: string | null;
    avatar: string | null;
    role: string;
    document_type: string | null;
    document_number: string | null;
    created_at: Date;
    updated_at: Date;
}

@Injectable()
export class UsersService {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
        private readonly logger: CustomLoggerService,
    ) { }

    async findByEmail(email: string): Promise<UserEntity | null> {
        const result = await this.db.query<UserRow>(
            `SELECT id, email, password_hash, firebase_uid, full_name, phone, avatar, role, document_type, document_number, created_at, updated_at
            FROM users WHERE email = $1`,
            [email],
        );

        if (result.rowCount === 0) {
            return null;
        }

        return this.mapRowToEntity(result.rows[0]);
    }

    async findByFirebaseUid(uid: string): Promise<UserEntity | null> {
        const result = await this.db.query<UserRow>(
            `SELECT id, email, password_hash, firebase_uid, full_name, phone, avatar, role, document_type, document_number, created_at, updated_at
            FROM users WHERE firebase_uid = $1`,
            [uid],
        );

        if (result.rowCount === 0) {
            return null;
        }

        return this.mapRowToEntity(result.rows[0]);
    }

    async findById(id: string): Promise<UserEntity | null> {
        const result = await this.db.query<UserRow>(
            `SELECT id, email, password_hash, firebase_uid, full_name, phone, avatar, role, document_type, document_number, created_at, updated_at
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
        passwordHash?: string;
        firebaseUid?: string;
        fullName?: string | null;
        phone?: string | null;
        avatar?: string | null;
        documentType?: string | null;
        documentNumber?: string | null;
        role: UserRole;
    }): Promise<UserEntity> {
        const result = await this.db.query<UserRow>(
            `INSERT INTO users (email, password_hash, firebase_uid, full_name, phone, avatar, document_type, document_number, role)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, email, password_hash, firebase_uid, full_name, phone, avatar, role, document_type, document_number, created_at, updated_at`,
            [
                params.email,
                params.passwordHash ?? null,
                params.firebaseUid ?? null,
                params.fullName ?? null,
                params.phone ?? null,
                params.avatar ?? null,
                params.documentType ?? null,
                params.documentNumber ?? null,
                params.role
            ],
        );

        const user = this.mapRowToEntity(result.rows[0]);

        // Log business event
        this.logger.logBusinessEvent('user_created', {
            userId: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName
        });

        return user;
    }

    async updateProfile(
        userId: string,
        params: {
            fullName?: string | null;
            email?: string;
            phone?: string;
            avatar?: string;
            documentType?: string;
            documentNumber?: string;
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

        if (params.phone !== undefined) {
            updates.push(`phone = $${placeholderIndex++}`);
            values.push(params.phone);
        }

        if (params.avatar !== undefined) {
            updates.push(`avatar = $${placeholderIndex++}`);
            values.push(params.avatar);
        }

        if (params.documentType !== undefined) {
            updates.push(`document_type = $${placeholderIndex++}`);
            values.push(params.documentType);
        }

        if (params.documentNumber !== undefined) {
            updates.push(`document_number = $${placeholderIndex++}`);
            values.push(params.documentNumber);
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
            RETURNING id, email, password_hash, firebase_uid, full_name, phone, avatar, role, document_type, document_number, created_at, updated_at`,
            values,
        );

        if (result.rowCount === 0) {
            throw new NotFoundException('User not found');
        }

        const updatedUser = this.mapRowToEntity(result.rows[0]);

        // Log business event
        this.logger.logBusinessEvent('user_profile_updated', {
            userId,
            changes: params,
            email: updatedUser.email,
            fullName: updatedUser.fullName
        });

        return updatedUser;
    }

    async updateFirebaseInfo(userId: string, firebaseUid: string, avatarUrl?: string): Promise<UserEntity> {
        const updates: string[] = ['firebase_uid = $2'];
        const values: unknown[] = [userId, firebaseUid];
        let placeholderIndex = 3;

        if (avatarUrl) {
            updates.push(`avatar = $${placeholderIndex++}`);
            values.push(avatarUrl);
        }

        updates.push(`updated_at = now()`);

        const result = await this.db.query<UserRow>(
            `UPDATE users
             SET ${updates.join(', ')}
             WHERE id = $1
             RETURNING id, email, password_hash, firebase_uid, full_name, phone, avatar, role, document_type, document_number, created_at, updated_at`,
            values,
        );

        if (result.rowCount === 0) {
            throw new NotFoundException('User not found');
        }

        return this.mapRowToEntity(result.rows[0]);
    }

    async updateGoogleInfo(userId: string, params: {
        firebaseUid: string;
        avatar?: string | null;
        fullName?: string | null;
        phone?: string | null;
    }): Promise<UserEntity> {
        const updates: string[] = ['firebase_uid = $2'];
        const values: unknown[] = [userId, params.firebaseUid];
        let placeholderIndex = 3;

        if (params.avatar) {
            updates.push(`avatar = $${placeholderIndex++}`);
            values.push(params.avatar);
        }

        if (params.fullName) {
            updates.push(`full_name = $${placeholderIndex++}`);
            values.push(params.fullName);
        }

        if (params.phone) {
            updates.push(`phone = $${placeholderIndex++}`);
            values.push(params.phone);
        }

        updates.push(`updated_at = now()`);

        const result = await this.db.query<UserRow>(
            `UPDATE users
             SET ${updates.join(', ')}
             WHERE id = $1
             RETURNING id, email, password_hash, firebase_uid, full_name, phone, avatar, role, document_type, document_number, created_at, updated_at`,
            values,
        );

        if (result.rowCount === 0) {
            throw new NotFoundException('User not found');
        }

        this.logger.logBusinessEvent('user_google_info_updated', {
            userId,
            hasAvatar: !!params.avatar,
            hasFullName: !!params.fullName,
            hasPhone: !!params.phone,
        });

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

        // Log security event
        this.logger.logSecurityEvent('password_updated', {
            userId,
            timestamp: new Date().toISOString()
        });
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
            firebaseUid: row.firebase_uid,
            fullName: row.full_name,
            phone: row.phone,
            avatar: row.avatar,
            role: row.role as UserEntity['role'],
            documentType: row.document_type,
            documentNumber: row.document_number,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
