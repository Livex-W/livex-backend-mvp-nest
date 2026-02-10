import { AggregateRoot } from '../../../../shared/domain/base/aggregate-root.base';
import { CategorySlug } from '../value-objects/category-slug.vo';

export interface CategoryProps {
    name: string;
    slug: CategorySlug;
    description?: string;
    iconUrl?: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

export class Category extends AggregateRoot<CategoryProps> {
    private constructor(id: string, props: CategoryProps) {
        super(id, props);
    }

    get name(): string { return this.props.name; }
    get slug(): CategorySlug { return this.props.slug; }
    get description(): string | undefined { return this.props.description; }
    get iconUrl(): string | undefined { return this.props.iconUrl; }
    get isActive(): boolean { return this.props.isActive; }
    get sortOrder(): number { return this.props.sortOrder; }
    get createdAt(): Date { return this.props.createdAt; }
    get updatedAt(): Date { return this.props.updatedAt; }

    static create(params: {
        id: string;
        name: string;
        slug?: string;
        description?: string;
        iconUrl?: string;
        sortOrder?: number;
    }): Category {
        const props: CategoryProps = {
            name: params.name,
            slug: params.slug ? CategorySlug.create(params.slug) : CategorySlug.fromName(params.name),
            description: params.description,
            iconUrl: params.iconUrl,
            isActive: true,
            sortOrder: params.sortOrder ?? 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        return new Category(params.id, props);
    }

    static reconstitute(id: string, props: CategoryProps): Category {
        return new Category(id, props);
    }

    update(params: {
        name?: string;
        description?: string;
        iconUrl?: string;
        sortOrder?: number;
    }): void {
        if (params.name !== undefined) {
            this.props.name = params.name;
            this.props.slug = CategorySlug.fromName(params.name);
        }
        if (params.description !== undefined) this.props.description = params.description;
        if (params.iconUrl !== undefined) this.props.iconUrl = params.iconUrl;
        if (params.sortOrder !== undefined) this.props.sortOrder = params.sortOrder;
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
}
