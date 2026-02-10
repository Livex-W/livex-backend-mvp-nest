/**
 * Domain Policy: Token Rotation
 * Encapsulates the business rules for JWT token refresh and rotation.
 */
export class TokenRotationPolicy {
    /**
     * Check if refresh token is still valid.
     */
    static isRefreshTokenValid(params: {
        expiresAt: Date;
        revokedAt?: Date;
    }): { valid: boolean; reason?: string } {
        if (params.revokedAt) {
            return { valid: false, reason: 'Token has been revoked' };
        }

        if (new Date() > params.expiresAt) {
            return { valid: false, reason: 'Token has expired' };
        }

        return { valid: true };
    }

    /**
     * Calculate access token expiration.
     */
    static calculateAccessTokenExpiresAt(ttlSeconds: number): Date {
        const expires = new Date();
        expires.setSeconds(expires.getSeconds() + ttlSeconds);
        return expires;
    }

    /**
     * Calculate refresh token expiration.
     */
    static calculateRefreshTokenExpiresAt(ttlSeconds: number): Date {
        const expires = new Date();
        expires.setSeconds(expires.getSeconds() + ttlSeconds);
        return expires;
    }

    /**
     * Check if token should be rotated (refresh token reuse).
     * Implements sliding window rotation.
     */
    static shouldRotateToken(params: {
        createdAt: Date;
        rotationWindowSeconds: number;
    }): boolean {
        const windowEnd = new Date(params.createdAt);
        windowEnd.setSeconds(windowEnd.getSeconds() + params.rotationWindowSeconds);
        return new Date() > windowEnd;
    }

    /**
     * Generate unique token identifier (JTI).
     */
    static generateJti(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * Check if token belongs to user.
     */
    static belongsToUser(tokenUserId: string, requestUserId: string): boolean {
        return tokenUserId === requestUserId;
    }

    /**
     * Validate password reset token.
     */
    static isPasswordResetTokenValid(params: {
        expiresAt: Date;
        usedAt?: Date;
    }): { valid: boolean; reason?: string } {
        if (params.usedAt) {
            return { valid: false, reason: 'Token has already been used' };
        }

        if (new Date() > params.expiresAt) {
            return { valid: false, reason: 'Token has expired' };
        }

        return { valid: true };
    }
}
