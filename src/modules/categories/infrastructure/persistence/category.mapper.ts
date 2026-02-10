import { Category, CategorySlug } from '../../domain/index';

interface CategoryRow {
    id: string;
    name: string;
    slug: string;
    description?: string;
    icon_url?: string;
    is_active: boolean;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
}

export class CategoryMapper {
    static toDomain(row: CategoryRow): Category {
        return Category.reconstitute(row.id, {
            name: row.name,
            slug: CategorySlug.create(row.slug),
            description: row.description,
            iconUrl: row.icon_url,
            isActive: row.is_active,
            sortOrder: row.sort_order,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }

    static toPersistence(category: Category): Record<string, unknown> {
        return {
            id: category.id,
            name: category.name,
            slug: category.slug.value,
            description: category.description,
            icon_url: category.iconUrl,
            is_active: category.isActive,
            sort_order: category.sortOrder,
            created_at: category.createdAt,
            updated_at: category.updatedAt,
        };
    }
}
