/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Inject, Injectable, ConflictException, UnauthorizedException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID, randomInt } from 'node:crypto';
import { PasswordHashService } from './services/password-hash.service';
import type { QueryResultRow } from 'pg';
import { UsersService } from '../users/users.service';
import { DATABASE_CLIENT } from '../database/database.module';
import { DatabaseClient } from '../database/database.client';
import { CustomLoggerService } from '../common/services/logger.service';
import { ResortsService } from '../resorts/resorts.service';
import type { UserEntity } from '../users/entities/user.entity';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import {
    DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    DEFAULT_BCRYPT_SALT_ROUNDS,
    DEFAULT_PASSWORD_RESET_TTL_SECONDS,
    DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    PASSWORD_REGEX,
} from './constants/auth.constants';
import type { AuthResult, TokenContext, AuthTokens } from './interfaces/auth-result.interface';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { LogoutDto } from './dto/logout.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { FirebaseAdminService } from './services/firebase-admin.service';

interface RefreshTokenRow extends QueryResultRow {
    id: string;
    user_id: string;
    jti: string;
    created_at: Date;
    expires_at: Date;
    revoked_at: Date | null;
    ip: string | null;
    user_agent: string | null;
}

interface PasswordResetTokenRow extends QueryResultRow {
    id: string;
    user_id: string;
    token: string;
    created_at: Date;
    expires_at: Date;
    used_at: Date | null;
}

import { EventEmitter2 } from '@nestjs/event-emitter';
import { PasswordResetRequestedEvent, ResortCreatedEvent, UserRegisteredEvent } from '../notifications/events/notification.events';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly passwordHashService: PasswordHashService,
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
        private readonly logger: CustomLoggerService,
        private readonly eventEmitter: EventEmitter2,
        private readonly firebaseAdminService: FirebaseAdminService,
        private readonly resortsService: ResortsService,
    ) { }

    async register(dto: RegisterDto, context: TokenContext): Promise<AuthResult> {
        const existingUser = await this.usersService.findByEmail(dto.email);
        if (existingUser) {
            throw new ConflictException('Este correo ya esta registradoready registered');
        }

        let firebaseUid = dto.firebaseUid;

        // If registering traditionally (no firebaseUid provided), create in Firebase to maintain consistency
        if (!firebaseUid && dto.password) {
            try {
                const firebaseUser = await this.firebaseAdminService.createUser(dto.email, dto.password, dto.fullName);
                firebaseUid = firebaseUser.uid;
            } catch (error) {
                this.logger.error('Failed to create user in Firebase', (error as Error).stack);
                // Proceed? Or fail? 
                // If we fail, we keep consistency.
                throw new InternalServerErrorException('Failed to create user in identity provider');
            }
        }

        let passwordHash: string | undefined;
        if (dto.password) {
            passwordHash = this.passwordHashService.hashPassword(dto.password);
        }

        const user = await this.usersService.createUser({
            email: dto.email,
            passwordHash,
            firebaseUid,
            fullName: dto.fullName,
            phone: dto.phone,
            avatar: dto.avatar,
            documentType: dto.documentType,
            documentNumber: dto.documentNumber,
            role: dto.role || 'tourist',
        });

        this.eventEmitter.emit(
            'user.registered',
            new UserRegisteredEvent(user.id, user.email, user.fullName || '', user.role)
        );

        // If role is 'resort', create an associated resort with minimal data
        // The resort owner can complete the details later
        let createdResort: Awaited<ReturnType<typeof this.resortsService.create>> | undefined;

        if (user.role === 'resort') {
            try {
                const resortName = dto.fullName || 'My Resort';
                createdResort = await this.resortsService.create(
                    {
                        name: resortName,
                        contact_email: dto.email,
                        contact_phone: dto.phone,
                        nit: dto.nit,
                        rnt: dto.rnt,
                        // Other fields will remain null/default, to be completed later
                    },
                    user.id
                );

                this.logger.logBusinessEvent('resort_auto_created_on_registration', {
                    userId: user.id,
                    resortId: createdResort.id,
                    resortName: createdResort.name,
                });

            } catch (error) {
                // Log the error but don't fail the registration
                // The user can create the resort manually later
                this.logger.error('Failed to auto-create resort for user', (error as Error).stack);
                this.logger.logSecurityEvent('resort_auto_creation_failed', {
                    userId: user.id,
                    email: user.email,
                    error: (error as Error).message,
                });
            }
        }

        // Log successful registration
        this.logger.logSecurityEvent('user_registered', {
            userId: user.id,
            email: user.email,
            role: user.role,
            ip: context.ip || undefined,
            userAgent: context.userAgent || undefined
        });

        const authResult = await this.issueAuthResult(user, context, { rotateFromJti: null });

        // Include resort in response if created
        if (createdResort) {
            return { ...authResult, resort: createdResort };
        }

        return authResult;
    }

    async login(dto: LoginDto, context: TokenContext): Promise<AuthResult> {
        const user = await this.usersService.findByEmail(dto.email);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.passwordHash) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await this.passwordHashService.comparePassword(dto.password, user.passwordHash);
        if (!isPasswordValid) {
            // Log failed login attempt
            this.logger.logSecurityEvent('login_failed', {
                email: dto.email,
                reason: 'invalid_password',
                ip: context.ip || undefined,
                userAgent: context.userAgent || undefined
            });
            throw new UnauthorizedException('Invalid credentials');
        }

        // Log successful login
        this.logger.logSecurityEvent('login_successful', {
            userId: user.id,
            email: user.email,
            role: user.role,
            ip: context.ip || undefined,
            userAgent: context.userAgent || undefined
        });

        return this.issueAuthResult(user, context, { rotateFromJti: null });
    }

    async loginWithGoogle(dto: GoogleLoginDto, context: TokenContext): Promise<AuthResult> {
        const decodedToken = await this.firebaseAdminService.verifyIdToken(dto.idToken);
        const firebaseUid = decodedToken.uid;
        const email = decodedToken.email;

        // Prioritize DTO values (from client), fallback to token values
        const name = dto.displayName || decodedToken.name || null;
        const picture = dto.photoUrl || decodedToken.picture || null;

        if (!email) {
            throw new BadRequestException('Google account must have an email');
        }

        let user = await this.usersService.findByFirebaseUid(firebaseUid);

        if (!user) {
            const existingUser = await this.usersService.findByEmail(email);

            if (existingUser) {
                // Link existing account with Google data
                user = await this.usersService.updateGoogleInfo(existingUser.id, {
                    firebaseUid,
                    avatar: existingUser.avatar || picture,
                    fullName: existingUser.fullName || name,
                    phone: existingUser.phone || dto.phone,
                });
                this.logger.logSecurityEvent('user_linked_google', { userId: user.id, email });
            } else {
                // Create new user with all available Google data
                user = await this.usersService.createUser({
                    email,
                    firebaseUid,
                    fullName: name,
                    phone: dto.phone,
                    avatar: picture,
                    role: 'tourist',
                });
                this.logger.logSecurityEvent('user_registered_google', { userId: user.id, email });

                // Emit event for welcome email (Google Registration)
                this.eventEmitter.emit(
                    'user.registered',
                    new UserRegisteredEvent(user.id, user.email, user.fullName || '', user.role)
                );
            }
        } else if (!user.avatar || !user.fullName) {
            // User exists but is missing some Google data, update it
            user = await this.usersService.updateGoogleInfo(user.id, {
                firebaseUid,
                avatar: user.avatar || picture,
                fullName: user.fullName || name,
                phone: user.phone || dto.phone,
            });
            this.logger.logSecurityEvent('user_google_data_enriched', { userId: user.id, email });
        }

        return this.issueAuthResult(user, context, { rotateFromJti: null });
    }

    async refresh(dto: RefreshTokenDto, context: TokenContext): Promise<AuthResult> {
        const payload = await this.verifyRefreshToken(dto.refreshToken);

        const user = await this.usersService.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const refreshTokenRecord = await this.getRefreshTokenByJti(payload.jti!);
        if (!refreshTokenRecord) {
            throw new UnauthorizedException('Refresh token revoked');
        }

        if (refreshTokenRecord.user_id !== user.id) {
            throw new UnauthorizedException('Refresh token does not belong to user');
        }

        const now = new Date();
        if (refreshTokenRecord.expires_at <= now || refreshTokenRecord.revoked_at) {
            throw new UnauthorizedException('Refresh token expired or revoked');
        }

        return this.issueAuthResult(user, context, { rotateFromJti: refreshTokenRecord.jti });
    }

    async logout(user: JwtPayload, dto: LogoutDto): Promise<{ success: true }> {
        if (dto.allDevices) {
            await this.revokeAllUserRefreshTokens(user.sub);
            return { success: true };
        }

        if (dto.refreshToken) {
            const payload = await this.verifyRefreshToken(dto.refreshToken);
            if (payload.sub !== user.sub) {
                throw new UnauthorizedException('Token does not belong to the current user');
            }

            await this.revokeRefreshTokenByJti(payload.jti!);
            return { success: true };
        }

        return { success: true };
    }

    async requestPasswordReset(dto: RequestPasswordResetDto): Promise<{ success: true; token: string }> {
        const user = await this.usersService.findByEmail(dto.email);
        if (!user) {
            // For security, do not reveal user existence. Return success without token.
            return { success: true, token: '' };
        }

        // Generate a 6-digit OTP
        const token = randomInt(100000, 1000000).toString();
        const expiresAt = new Date(Date.now() + this.getPasswordResetTtl() * 1000);

        await this.db.query(
            `INSERT INTO password_reset_tokens (user_id, token, expires_at)
            VALUES ($1, $2, $3)`,
            [user.id, token, expiresAt],
        );

        this.eventEmitter.emit(
            'password.reset.requested',
            new PasswordResetRequestedEvent(
                user.id,
                user.email,
                user.fullName ?? "",
                token
            )
        );

        return { success: true, token };
    }

    async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
        if (!PASSWORD_REGEX.test(dto.password)) {
            throw new BadRequestException('Password does not meet complexity requirements');
        }

        const tokenRow = await this.getPasswordResetToken(dto.token);
        if (!tokenRow) {
            throw new BadRequestException('Invalid reset token');
        }

        if (tokenRow.used_at) {
            throw new BadRequestException('Reset token already used');
        }

        const now = new Date();
        if (tokenRow.expires_at <= now) {
            throw new BadRequestException('Reset token expired');
        }

        const user = await this.usersService.findById(tokenRow.user_id);
        if (!user) {
            throw new BadRequestException('User not found');
        }

        const passwordHash = this.passwordHashService.hashPassword(dto.password);
        await this.usersService.updatePassword(user.id, passwordHash);

        await this.db.query(
            `UPDATE password_reset_tokens
                SET used_at = now()
            WHERE id = $1`,
            [tokenRow.id],
        );

        await this.revokeAllUserRefreshTokens(user.id);

        return { success: true };
    }

    async changePassword(user: JwtPayload, currentPassword: string, newPassword: string): Promise<{ success: true }> {
        if (!PASSWORD_REGEX.test(newPassword)) {
            throw new BadRequestException('Password does not meet complexity requirements');
        }

        const userEntity = await this.usersService.findById(user.sub);
        if (!userEntity) {
            throw new UnauthorizedException('User not found');
        }

        if (!userEntity.passwordHash) {
            throw new UnauthorizedException('User has no password set');
        }

        const isValid = await this.passwordHashService.comparePassword(currentPassword, userEntity.passwordHash);
        if (!isValid) {
            throw new UnauthorizedException('Current password invalid');
        }

        const passwordHash = this.passwordHashService.hashPassword(newPassword);
        await this.usersService.updatePassword(userEntity.id, passwordHash);
        await this.revokeAllUserRefreshTokens(userEntity.id);

        return { success: true };
    }

    private async issueAuthResult(user: UserEntity, context: TokenContext, options: { rotateFromJti: string | null }): Promise<AuthResult> {
        const accessTtl = this.getAccessTokenTtl();
        const refreshTtl = this.getRefreshTokenTtl();

        const refreshJti = randomUUID();
        const refreshExpiresAt = new Date(Date.now() + refreshTtl * 1000);

        const accessPayload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            tokenType: 'access',
        };

        const refreshPayload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            tokenType: 'refresh',
            jti: refreshJti,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(accessPayload, {
                expiresIn: `${accessTtl}s`,
            }),
            this.jwtService.signAsync(refreshPayload, {
                expiresIn: `${refreshTtl}s`,
            }),
        ]);

        await this.storeRefreshToken({
            userId: user.id,
            jti: refreshJti,
            expiresAt: refreshExpiresAt,
            context,
        });

        if (options.rotateFromJti) {
            await this.revokeRefreshTokenByJti(options.rotateFromJti);
        }

        const tokens: AuthTokens = {
            accessToken,
            accessTokenExpiresAt: new Date(Date.now() + accessTtl * 1000).toISOString(),
            refreshToken,
            refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
        };

        const safeUser = this.usersService.toSafeUser(user);

        return { user: safeUser, tokens };
    }

    private getAccessTokenTtl(): number {
        return this.configService.get<number>('JWT_ACCESS_TOKEN_TTL_SECONDS') ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
    }

    private getRefreshTokenTtl(): number {
        return this.configService.get<number>('JWT_REFRESH_TOKEN_TTL_SECONDS') ?? DEFAULT_REFRESH_TOKEN_TTL_SECONDS;
    }

    private getPasswordResetTtl(): number {
        return this.configService.get<number>('PASSWORD_RESET_TTL_SECONDS') ?? DEFAULT_PASSWORD_RESET_TTL_SECONDS;
    }

    private getBcryptSaltRounds(): number {
        return this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? DEFAULT_BCRYPT_SALT_ROUNDS;
    }

    private async storeRefreshToken(params: {
        userId: string;
        jti: string;
        expiresAt: Date;
        context: TokenContext;
    }): Promise<void> {
        await this.db.query(
            `INSERT INTO refresh_tokens (user_id, jti, expires_at, ip, user_agent)
            VALUES ($1, $2, $3, $4, $5)`,
            [params.userId, params.jti, params.expiresAt, params.context.ip ?? null, params.context.userAgent ?? null],
        );
    }

    private async getRefreshTokenByJti(jti: string): Promise<RefreshTokenRow | null> {
        const result = await this.db.query<RefreshTokenRow>(
            `SELECT id, user_id, jti, created_at, expires_at, revoked_at, ip, user_agent
            FROM refresh_tokens
            WHERE jti = $1`,
            [jti],
        );

        if (result.rowCount === 0) {
            return null;
        }

        return result.rows[0];
    }

    private async revokeRefreshTokenByJti(jti: string): Promise<void> {
        await this.db.query(
            `UPDATE refresh_tokens
            SET revoked_at = now()
            WHERE jti = $1
            AND revoked_at IS NULL`,
            [jti],
        );
    }

    private async revokeAllUserRefreshTokens(userId: string): Promise<void> {
        await this.db.query(
            `UPDATE refresh_tokens
            SET revoked_at = now()
            WHERE user_id = $1
            AND revoked_at IS NULL`,
            [userId],
        );
    }

    private async getPasswordResetToken(token: string): Promise<PasswordResetTokenRow | null> {
        const result = await this.db.query<PasswordResetTokenRow>(
            `SELECT id, user_id, token, created_at, expires_at, used_at
            FROM password_reset_tokens
            WHERE token = $1`,
            [token],
        );

        if (result.rowCount === 0) {
            return null;
        }

        return result.rows[0];
    }

    private async verifyRefreshToken(token: string): Promise<JwtPayload> {
        try {
            const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
                secret: this.configService.get<string>('JWT_SECRET', 'dev-secret-change-me'),
            });

            if (payload.tokenType !== 'refresh' || !payload.jti) {
                throw new UnauthorizedException('Invalid refresh token payload');
            }

            return payload;
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }

            throw new UnauthorizedException('Invalid refresh token');
        }
    }
}
