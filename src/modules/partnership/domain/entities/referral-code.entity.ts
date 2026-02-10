import { Entity } from '../../../../shared/domain/base/entity.base';

export interface ReferralCodeProps {
    agentId: string;
    code: string;
    description?: string;
    isActive: boolean;
    usageCount: number;
    parentCodeId?: string;
    experienceRestrictions: string[];
    categoryRestrictions: string[];
    createdAt: Date;
    updatedAt: Date;
}

export class ReferralCode extends Entity<ReferralCodeProps> {
    private constructor(id: string, props: ReferralCodeProps) {
        super(id, props);
    }

    get agentId(): string { return this.props.agentId; }
    get code(): string { return this.props.code; }
    get description(): string | undefined { return this.props.description; }
    get isActive(): boolean { return this.props.isActive; }
    get usageCount(): number { return this.props.usageCount; }
    get parentCodeId(): string | undefined { return this.props.parentCodeId; }
    get experienceRestrictions(): string[] { return this.props.experienceRestrictions; }
    get categoryRestrictions(): string[] { return this.props.categoryRestrictions; }
    get createdAt(): Date { return this.props.createdAt; }
    get updatedAt(): Date { return this.props.updatedAt; }

    get isVariant(): boolean {
        return !!this.props.parentCodeId;
    }

    get hasRestrictions(): boolean {
        return this.props.experienceRestrictions.length > 0 ||
            this.props.categoryRestrictions.length > 0;
    }

    static create(params: {
        id: string;
        agentId: string;
        code: string;
        description?: string;
        parentCodeId?: string;
    }): ReferralCode {
        const normalizedCode = params.code.toUpperCase().trim();
        if (!/^[A-Z0-9-]+$/.test(normalizedCode)) {
            throw new Error('Referral code can only contain letters, numbers, and hyphens');
        }
        if (normalizedCode.length < 4 || normalizedCode.length > 20) {
            throw new Error('Referral code must be between 4 and 20 characters');
        }

        return new ReferralCode(params.id, {
            agentId: params.agentId,
            code: normalizedCode,
            description: params.description,
            isActive: true,
            usageCount: 0,
            parentCodeId: params.parentCodeId,
            experienceRestrictions: [],
            categoryRestrictions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    static reconstitute(id: string, props: ReferralCodeProps): ReferralCode {
        return new ReferralCode(id, props);
    }

    incrementUsage(): void {
        this.props.usageCount++;
        this.props.updatedAt = new Date();
    }

    activate(): void {
        this.props.isActive = true;
        this.props.updatedAt = new Date();
    }

    deactivate(): void {
        this.props.isActive = false;
        this.props.updatedAt = new Date();
    }

    addExperienceRestriction(experienceId: string): void {
        if (!this.props.experienceRestrictions.includes(experienceId)) {
            this.props.experienceRestrictions.push(experienceId);
            this.props.updatedAt = new Date();
        }
    }

    addCategoryRestriction(categorySlug: string): void {
        if (!this.props.categoryRestrictions.includes(categorySlug)) {
            this.props.categoryRestrictions.push(categorySlug);
            this.props.updatedAt = new Date();
        }
    }

    removeRestriction(restrictionId: string): void {
        this.props.experienceRestrictions = this.props.experienceRestrictions.filter(r => r !== restrictionId);
        this.props.categoryRestrictions = this.props.categoryRestrictions.filter(r => r !== restrictionId);
        this.props.updatedAt = new Date();
    }

    canBeUsedFor(experienceId: string, categorySlug: string): boolean {
        if (!this.props.isActive) return false;
        if (!this.hasRestrictions) return true;

        const matchesExperience = this.props.experienceRestrictions.length === 0 ||
            this.props.experienceRestrictions.includes(experienceId);
        const matchesCategory = this.props.categoryRestrictions.length === 0 ||
            this.props.categoryRestrictions.includes(categorySlug);

        return matchesExperience && matchesCategory;
    }
}
