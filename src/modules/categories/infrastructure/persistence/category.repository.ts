import { Inject, Injectable } from '@nestjs/common';
import { DatabaseClient } from '../../../../database/database.client';
import { DATABASE_CLIENT } from '../../../../database/database.module';
import { Category } from '../../domain/aggregates/category.aggregate';
import { ICategoryRepository } from '../../domain/repositories/category.repository.interface';
import { CategoryMapper } from './category.mapper';

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

@Injectable()
export class CategoryRepository implements ICategoryRepository {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    ) { }

    async save(category: Category): Promise<void> {
        const data = CategoryMapper.toPersistence(category);

        await this.db.query(
            `INSERT INTO categories (id, name, slug, description, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                slug = EXCLUDED.slug,
                description = EXCLUDED.description,
                updated_at = EXCLUDED.updated_at`,
            [data.id, data.name, data.slug, data.description, data.created_at, data.updated_at],
        );
    }

    async findById(id: string): Promise<Category | null> {
        const result = await this.db.query<CategoryRow>(
            `SELECT id, name, slug, NULL as description, NULL as icon_url, 
                true as is_active, 0 as sort_order, created_at, updated_at
            FROM categories WHERE id = $1`,
            [id],
        );
        if (result.rows.length === 0) return null;
        return CategoryMapper.toDomain(result.rows[0]);
    }

    async findBySlug(slug: string): Promise<Category | null> {
        const result = await this.db.query<CategoryRow>(
            `SELECT id, name, slug, NULL as description, NULL as icon_url, 
                true as is_active, 0 as sort_order, created_at, updated_at
            FROM categories WHERE slug = $1`,
            [slug],
        );
        if (result.rows.length === 0) return null;
        return CategoryMapper.toDomain(result.rows[0]);
    }

    async findAll(): Promise<Category[]> {
        const result = await this.db.query<CategoryRow>(
            `SELECT id, name, slug, NULL as description, NULL as icon_url, 
                true as is_active, 0 as sort_order, created_at, updated_at
            FROM categories ORDER BY name ASC`,
        );
        return result.rows.map(row => CategoryMapper.toDomain(row));
    }

    async findActive(): Promise<Category[]> {
        return this.findAll(); // All categories are active in current schema
    }

    async delete(id: string): Promise<void> {
        await this.db.query('DELETE FROM categories WHERE id = $1', [id]);
    }

    async exists(id: string): Promise<boolean> {
        const result = await this.db.query<{ exists: boolean }>(
            'SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1) as exists',
            [id],
        );
        return result.rows[0]?.exists ?? false;
    }

    async existsBySlug(slug: string): Promise<boolean> {
        const result = await this.db.query<{ exists: boolean }>(
            'SELECT EXISTS(SELECT 1 FROM categories WHERE slug = $1) as exists',
            [slug],
        );
        return result.rows[0]?.exists ?? false;
    }
}
