import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface ExperienceFilterProps {
    readonly category?: string;
    readonly resortId?: string;
    readonly location?: string;
    readonly minPriceCents?: number;
    readonly maxPriceCents?: number;
    readonly minRating?: number;
    readonly minDurationMinutes?: number;
    readonly maxDurationMinutes?: number;
    readonly isActive?: boolean;
    readonly status?: string;
    readonly searchTerm?: string;
}

export class ExperienceFilter extends ValueObject<ExperienceFilterProps> {
    private constructor(props: ExperienceFilterProps) {
        super(props);
    }

    get category(): string | undefined { return this.props.category; }
    get resortId(): string | undefined { return this.props.resortId; }
    get location(): string | undefined { return this.props.location; }
    get minPriceCents(): number | undefined { return this.props.minPriceCents; }
    get maxPriceCents(): number | undefined { return this.props.maxPriceCents; }
    get minRating(): number | undefined { return this.props.minRating; }
    get minDurationMinutes(): number | undefined { return this.props.minDurationMinutes; }
    get maxDurationMinutes(): number | undefined { return this.props.maxDurationMinutes; }
    get isActive(): boolean | undefined { return this.props.isActive; }
    get status(): string | undefined { return this.props.status; }
    get searchTerm(): string | undefined { return this.props.searchTerm; }

    get hasPriceFilter(): boolean {
        return this.props.minPriceCents !== undefined || this.props.maxPriceCents !== undefined;
    }

    get hasDurationFilter(): boolean {
        return this.props.minDurationMinutes !== undefined || this.props.maxDurationMinutes !== undefined;
    }

    get hasAnyFilter(): boolean {
        return Object.values(this.props).some(v => v !== undefined);
    }

    static create(params: Partial<ExperienceFilterProps> = {}): ExperienceFilter {
        if (params.minPriceCents !== undefined && params.maxPriceCents !== undefined) {
            if (params.minPriceCents > params.maxPriceCents) {
                throw new Error('Min price cannot be greater than max price');
            }
        }
        if (params.minRating !== undefined && (params.minRating < 0 || params.minRating > 5)) {
            throw new Error('Rating must be between 0 and 5');
        }

        return new ExperienceFilter({
            category: params.category,
            resortId: params.resortId,
            location: params.location,
            minPriceCents: params.minPriceCents,
            maxPriceCents: params.maxPriceCents,
            minRating: params.minRating,
            minDurationMinutes: params.minDurationMinutes,
            maxDurationMinutes: params.maxDurationMinutes,
            isActive: params.isActive,
            status: params.status,
            searchTerm: params.searchTerm?.trim(),
        });
    }

    static activeOnly(): ExperienceFilter {
        return new ExperienceFilter({ isActive: true, status: 'active' });
    }

    withCategory(category: string): ExperienceFilter {
        return new ExperienceFilter({ ...this.props, category });
    }

    withPriceRange(minCents: number, maxCents: number): ExperienceFilter {
        return new ExperienceFilter({
            ...this.props,
            minPriceCents: minCents,
            maxPriceCents: maxCents,
        });
    }

    protected equalsCore(other: ExperienceFilter): boolean {
        return JSON.stringify(this.props) === JSON.stringify(other.props);
    }
}
