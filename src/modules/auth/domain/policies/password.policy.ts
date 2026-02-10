/**
 * Domain Policy: Password
 * Encapsulates the business rules for password validation.
 */
export class PasswordPolicy {
    private static readonly MIN_LENGTH = 8;
    private static readonly MAX_LENGTH = 128;

    /**
     * Validate password meets security requirements.
     */
    static validate(password: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (password.length < this.MIN_LENGTH) {
            errors.push(`Password must be at least ${this.MIN_LENGTH} characters`);
        }

        if (password.length > this.MAX_LENGTH) {
            errors.push(`Password must be at most ${this.MAX_LENGTH} characters`);
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Check if new password is different from current.
     */
    static isDifferentFromCurrent(
        newPasswordHash: string,
        currentPasswordHash: string,
    ): boolean {
        return newPasswordHash !== currentPasswordHash;
    }

    /**
     * Get password strength score (0-4).
     */
    static getStrengthScore(password: string): number {
        let score = 0;

        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        return Math.min(4, score);
    }

    /**
     * Get human-readable strength label.
     */
    static getStrengthLabel(score: number): string {
        const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
        return labels[Math.min(score, 4)];
    }
}
