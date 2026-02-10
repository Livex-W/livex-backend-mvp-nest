/**
 * Domain Policy: Referral Code Validation
 * Encapsulates the business rules for validating referral/influencer codes.
 */
export class ReferralCodeValidator {
    /**
     * Validate code format: uppercase alphanumeric with hyphens, 4-20 chars.
     */
    static isValidFormat(code: string): boolean {
        const normalizedCode = code.toUpperCase().trim();
        return /^[A-Z0-9-]{4,20}$/.test(normalizedCode);
    }

    /**
     * Normalize code to uppercase without spaces.
     */
    static normalize(code: string): string {
        return code.toUpperCase().trim();
    }

    /**
     * Check if code is active and can be used.
     */
    static isCodeUsable(params: {
        isActive: boolean;
        expiresAt?: Date;
        usageLimit?: number;
        usageCount: number;
    }): { valid: boolean; reason?: string } {
        if (!params.isActive) {
            return { valid: false, reason: 'Code is inactive' };
        }

        if (params.expiresAt && new Date() > params.expiresAt) {
            return { valid: false, reason: 'Code has expired' };
        }

        if (params.usageLimit && params.usageCount >= params.usageLimit) {
            return { valid: false, reason: 'Code usage limit reached' };
        }

        return { valid: true };
    }

    /**
     * Check if code passes restriction filters.
     */
    static passesRestrictions(params: {
        experienceRestrictions: string[];
        categoryRestrictions: string[];
        resortRestrictions: string[];
        targetExperienceId: string;
        targetCategorySlug: string;
        targetResortId: string;
    }): { valid: boolean; reason?: string } {
        // If no restrictions, allow all
        const hasRestrictions =
            params.experienceRestrictions.length > 0 ||
            params.categoryRestrictions.length > 0 ||
            params.resortRestrictions.length > 0;

        if (!hasRestrictions) {
            return { valid: true };
        }

        // Check experience restriction
        if (params.experienceRestrictions.length > 0 &&
            !params.experienceRestrictions.includes(params.targetExperienceId)) {
            return { valid: false, reason: 'Code not valid for this experience' };
        }

        // Check category restriction
        if (params.categoryRestrictions.length > 0 &&
            !params.categoryRestrictions.includes(params.targetCategorySlug)) {
            return { valid: false, reason: 'Code not valid for this category' };
        }

        // Check resort restriction
        if (params.resortRestrictions.length > 0 &&
            !params.resortRestrictions.includes(params.targetResortId)) {
            return { valid: false, reason: 'Code not valid for this resort' };
        }

        return { valid: true };
    }

    /**
     * Check if user can use their own referral code.
     */
    static canUseOwnCode(codeOwnerId: string, userId: string): boolean {
        // Users cannot use their own codes
        return codeOwnerId !== userId;
    }
}
