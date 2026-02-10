import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface CategorySlugProps {
    readonly value: string;
}

export class CategorySlug extends ValueObject<CategorySlugProps> {
    private constructor(props: CategorySlugProps) {
        super(props);
    }

    get value(): string {
        return this.props.value;
    }

    static create(slug: string): CategorySlug {
        if (!slug || slug.trim().length === 0) {
            throw new Error('Category slug cannot be empty');
        }
        const normalized = slug.toLowerCase().trim();
        if (!/^[a-z0-9-]+$/.test(normalized)) {
            throw new Error('Category slug can only contain lowercase letters, numbers, and hyphens');
        }
        return new CategorySlug({ value: normalized });
    }

    static fromName(name: string): CategorySlug {
        const slug = name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return new CategorySlug({ value: slug });
    }

    protected equalsCore(other: CategorySlug): boolean {
        return this.props.value === other.props.value;
    }
}
