import { Inject, Injectable, ConflictException, UnauthorizedException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID, randomInt, createHash } from 'node:crypto';

import type { IRefreshTokenRepository } from '../domain/repositories/refresh-token.repository.interface';
import { REFRESH_TOKEN_REPOSITORY } from '../domain/repositories/refresh-token.repository.interface';
import type { IPasswordResetTokenRepository } from '../domain/repositories/password-reset-token.repository.interface';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from '../domain/repositories/password-reset-token.repository.interface';
import type { IUserRepository } from '../../identity/domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../identity/domain/repositories/user.repository.interface';
import { RefreshToken } from '../domain/entities/refresh-token.entity';
import { PasswordResetToken } from '../domain/entities/password-reset-token.entity';
import { PasswordPolicy } from '../domain/policies/password.policy';
import { User } from '../../identity/domain/aggregates/user.aggregate';
import { Email } from '../../identity/domain/value-objects/email.vo';
import { UserId } from '../../identity/domain/value-objects/user-id.vo';
import { UserRole } from '../../identity/domain/value-objects/user-role.vo';

import { PasswordHashService } from '../../../auth/services/password-hash.service';
import { FirebaseAdminService } from '../../../auth/services/firebase-admin.service';
import { CustomLoggerService } from '../../../common/services/logger.service';

import type { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import type { UserRole as LegacyUserRole } from '../../../common/constants/roles';
import {
    DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    DEFAULT_PASSWORD_RESET_TTL_SECONDS,
    DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
} from '../../../auth/constants/auth.constants';

export interface TokenContext {
    ip?: string;
    userAgent?: string;
}

export interface AuthTokens {
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
}

export interface AuthResult {
    user: SafeUser;
    tokens: AuthTokens;
}

export interface SafeUser {
    id: string;
    email: string;
    role: string;
    fullName: string;
    phone?: string;
    avatar?: string;
    isActive: boolean;
    isEmailVerified: boolean;
}

export interface RegisterDto {
    email: string;
    password?: string;
    firebaseUid?: string;
    fullName?: string;
    phone?: string;
    avatar?: string;
    role?: string;
    // Resort onboarding data
    nit?: string;
    rnt?: string;
}

export interface LoginDto {
    email: string;
    password: string;
}

export interface RefreshTokenDto {
    refreshToken: string;
}

export interface GoogleLoginDto {
    idToken: string;
    phone?: string;
    displayName?: string;
    photoUrl?: string;
}

@Injectable()
export class AuthApplicationService {
    constructor(
        @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
        @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: IRefreshTokenRepository,
        @Inject(PASSWORD_RESET_TOKEN_REPOSITORY) private readonly passwordResetTokenRepository: IPasswordResetTokenRepository,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly passwordHashService: PasswordHashService,
        private readonly firebaseAdminService: FirebaseAdminService,
        private readonly logger: CustomLoggerService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async register(dto: RegisterDto, context: TokenContext): Promise<AuthResult> {
        // Check if user exists
        const emailVO = Email.create(dto.email);
        const existingUser = await this.userRepository.findByEmail(emailVO);
        if (existingUser) {
            throw new ConflictException('Este correo ya está registrado');
        }

        let firebaseUid = dto.firebaseUid;

        // Create Firebase user if registering traditionally
        if (!firebaseUid && dto.password) {
            try {
                const firebaseUser = await this.firebaseAdminService.createUser(
                    dto.email,
                    dto.password,
                    dto.fullName,
                );
                firebaseUid = firebaseUser.uid;
            } catch (err) {
                const error = err as Error;
                this.logger.error('Failed to create user in Firebase', error.stack);
                throw new InternalServerErrorException('Failed to create user in identity provider');
            }
        }

        // Create user aggregate
        const user = User.create({
            firebaseUid: firebaseUid || '',
            email: emailVO,
            passwordHash: dto.password ? this.passwordHashService.hashPassword(dto.password) : undefined,
            fullName: dto.fullName,
            avatar: dto.avatar,
            role: dto.role ? UserRole.fromString(dto.role) : undefined,
            phone: dto.phone,
            // Resort onboarding data (will be passed via event to catalog module)
            nit: dto.nit,
            rnt: dto.rnt,
        });

        // Save user (will emit UserRegisteredEvent)
        await this.userRepository.save(user);

        this.logger.logSecurityEvent('user_registered', {
            userId: user.id,
            email: dto.email,
            role: user.role.value,
            ip: context.ip,
            userAgent: context.userAgent,
        });

        return this.issueAuthResult(user, context);
    }

    async login(dto: LoginDto, context: TokenContext): Promise<AuthResult> {
        const emailVO = Email.create(dto.email);
        const user = await this.userRepository.findByEmail(emailVO);

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.passwordHash) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await this.passwordHashService.comparePassword(
            dto.password,
            user.passwordHash,
        );

        if (!isPasswordValid) {
            this.logger.logSecurityEvent('login_failed', {
                email: dto.email,
                reason: 'invalid_password',
                ip: context.ip,
                userAgent: context.userAgent,
            });
            throw new UnauthorizedException('Invalid credentials');
        }

        // Record login
        user.recordLogin();
        await this.userRepository.save(user);

        this.logger.logSecurityEvent('login_successful', {
            userId: user.id,
            email: user.email.value,
            role: user.role.value,
            ip: context.ip,
            userAgent: context.userAgent,
        });

        return this.issueAuthResult(user, context);
    }

    async loginWithGoogle(dto: GoogleLoginDto, context: TokenContext): Promise<AuthResult> {
        // Verify the Firebase ID token
        const decodedToken = await this.firebaseAdminService.verifyIdToken(dto.idToken);
        const firebaseUid = decodedToken.uid;
        const email = decodedToken.email;

        if (!email) {
            throw new UnauthorizedException('Email not available from Google account');
        }

        // Check if user exists by Firebase UID
        let user = await this.userRepository.findByFirebaseUid(firebaseUid);

        if (!user) {
            // Check by email (user may have registered with password first)
            const emailVO = Email.create(email);
            user = await this.userRepository.findByEmail(emailVO);

            if (!user) {
                // Create new user
                user = User.create({
                    firebaseUid,
                    email: Email.create(email),
                    fullName: dto.displayName || (decodedToken.name as string),
                    avatar: dto.photoUrl || decodedToken.picture,
                    phone: dto.phone,
                });

                await this.userRepository.save(user);

                this.logger.logSecurityEvent('user_registered_google', {
                    userId: user.id,
                    email: user.email.value,
                    ip: context.ip,
                    userAgent: context.userAgent,
                });
            }
        }

        user.recordLogin();
        await this.userRepository.save(user);

        this.logger.logSecurityEvent('login_google_successful', {
            userId: user.id,
            email: user.email.value,
            ip: context.ip,
            userAgent: context.userAgent,
        });

        return this.issueAuthResult(user, context);
    }

    async refresh(dto: RefreshTokenDto, context: TokenContext): Promise<AuthResult> {
        const payload = await this.verifyRefreshToken(dto.refreshToken);

        const userId = UserId.fromString(payload.sub);
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // Find token by JTI (since DB stores JTI, not hash)
        // const tokenHash = this.hashToken(dto.refreshToken); 
        // const refreshToken = await this.refreshTokenRepository.findByHashedToken(tokenHash);

        if (!payload.jti) {
            throw new UnauthorizedException('Invalid token payload: missing jti');
        }
        const refreshToken = await this.refreshTokenRepository.findById(payload.jti);

        if (!refreshToken || !refreshToken.isValid) {
            throw new UnauthorizedException('Refresh token expired or revoked');
        }

        if (refreshToken.userId !== user.id) {
            throw new UnauthorizedException('Token does not belong to user');
        }

        // Revoke old token and issue new one
        refreshToken.revoke();
        await this.refreshTokenRepository.save(refreshToken);

        return this.issueAuthResult(user, context);
    }

    async logout(userId: string, allDevices: boolean = false): Promise<void> {
        if (allDevices) {
            await this.refreshTokenRepository.revokeAllForUser(userId);
        }
    }

    async requestPasswordReset(email: string): Promise<{ success: true; token: string }> {
        const emailVO = Email.create(email);
        const user = await this.userRepository.findByEmail(emailVO);

        if (!user) {
            // Don't reveal if user exists
            return { success: true, token: '' };
        }

        // Generate 6-digit OTP - stored as-is in DB (legacy schema uses VARCHAR(6))
        const token = randomInt(100000, 1000000).toString();
        const expiresAt = new Date(Date.now() + this.getPasswordResetTtl() * 1000);

        const resetToken = PasswordResetToken.create({
            id: randomUUID(),
            userId: user.id,
            hashedToken: token, // Not actually hashed - legacy DB stores plain token
            expiresAt,
        });

        await this.passwordResetTokenRepository.save(resetToken);

        // Emit event with structure expected by NotificationListener
        this.eventEmitter.emit('password.reset.requested', {
            userId: user.id,
            userEmail: user.email.value,
            userName: user.fullName ?? '',
            resetToken: token,
        });

        return { success: true, token };
    }

    async resetPassword(token: string, newPassword: string): Promise<void> {
        const validation = PasswordPolicy.validate(newPassword);
        if (!validation.valid) {
            throw new BadRequestException(validation.errors.join(', '));
        }

        // Token is stored as plain text in DB (legacy schema)
        const resetToken = await this.passwordResetTokenRepository.findByHashedToken(token);
        if (!resetToken || !resetToken.isValid) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        // Mark token as used
        resetToken.markAsUsed();
        await this.passwordResetTokenRepository.save(resetToken);

        // Revoke all refresh tokens
        await this.refreshTokenRepository.revokeAllForUser(resetToken.userId);
    }

    private async issueAuthResult(user: User, context: TokenContext): Promise<AuthResult> {
        const accessTtl = this.getAccessTokenTtl();
        const refreshTtl = this.getRefreshTokenTtl();

        const refreshJti = randomUUID();
        const refreshExpiresAt = new Date(Date.now() + refreshTtl * 1000);

        const accessPayload: JwtPayload = {
            sub: user.id,
            email: user.email.value,
            role: this.mapRoleToLegacy(user.role),
            fullName: user.fullName,
            tokenType: 'access',
        };

        const refreshPayload: JwtPayload = {
            sub: user.id,
            email: user.email.value,
            role: this.mapRoleToLegacy(user.role),
            fullName: user.fullName,
            tokenType: 'refresh',
            jti: refreshJti,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(accessPayload, { expiresIn: `${accessTtl}s` }),
            this.jwtService.signAsync(refreshPayload, { expiresIn: `${refreshTtl}s` }),
        ]);

        // Store refresh token (hashed)
        const refreshTokenEntity = RefreshToken.create({
            id: refreshJti,
            userId: user.id,
            hashedToken: this.hashToken(refreshToken),
            expiresAt: refreshExpiresAt,
            deviceInfo: context.userAgent,
            ipAddress: context.ip,
        });

        await this.refreshTokenRepository.save(refreshTokenEntity);

        return {
            user: this.toSafeUser(user),
            tokens: {
                accessToken,
                accessTokenExpiresAt: new Date(Date.now() + accessTtl * 1000).toISOString(),
                refreshToken,
                refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
            },
        };
    }

    private toSafeUser(user: User): SafeUser {
        return {
            id: user.id,
            email: user.email.value,
            role: user.role.toString(),
            fullName: user.fullName,
            phone: user.phone,
            avatar: user.avatar,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
        };
    }

    private hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
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
        } catch (err) {
            if (err instanceof UnauthorizedException) throw err;
            throw new UnauthorizedException('Invalid refresh token');
        }
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

    private mapRoleToLegacy(role: UserRole): LegacyUserRole {
        // Map DDD role values to legacy role strings
        const roleMapping: Record<string, LegacyUserRole> = {
            tourist: 'tourist',
            guest: 'tourist',
            vip: 'tourist',
            resort: 'resort',
            resort_owner: 'resort',
            resort_staff: 'resort',
            agent: 'agent',
            admin: 'admin',
            super_admin: 'admin',
        };
        return roleMapping[role.value] ?? 'tourist';
    }
}
